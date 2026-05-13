import { NextRequest, NextResponse } from "next/server";

// Proxy to OpenStreetMap Nominatim for free address autocomplete.
// Nominatim requires a User-Agent and has a 1-req/s limit per IP. We send
// a descriptive UA and rely on donor form traffic being low volume.
// Docs: https://nominatim.org/release-docs/develop/api/Search/

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "JRE Donation Form (office@thejre.org)";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

interface Suggestion {
  label: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ suggestions: [] as Suggestion[] });
  }

  const params = new URLSearchParams({
    q,
    format: "json",
    addressdetails: "1",
    limit: "6",
    "accept-language": "en",
  });

  try {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      // Nominatim caches are fine to piggyback on
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json({ suggestions: [] as Suggestion[] });
    }
    const data = (await res.json()) as NominatimResult[];
    const suggestions: Suggestion[] = data.map((r) => {
      const a = r.address ?? {};
      const line1 = [a.house_number, a.road].filter(Boolean).join(" ").trim();
      const city = a.city || a.town || a.village || "";
      return {
        label: r.display_name,
        line1,
        city,
        state: a.state || "",
        zip: a.postcode || "",
        country: a.country || "",
      };
    });
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("geocode proxy failed:", err);
    return NextResponse.json({ suggestions: [] as Suggestion[] });
  }
}
