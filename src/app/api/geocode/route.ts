import { NextRequest, NextResponse } from "next/server";

/**
 * Address autocomplete proxy.
 *
 * Tiered providers, picked by whichever credential is available:
 *   1. Google Places Autocomplete (New)  — `GOOGLE_PLACES_API_KEY`
 *   2. Mapbox Geocoding v5               — `MAPBOX_ACCESS_TOKEN`
 *   3. OpenStreetMap Nominatim (free)    — no key needed
 *
 * Google gives the most accurate US address results (real rooftops,
 * apartment coverage). Mapbox is a solid mid-tier. Nominatim is the
 * zero-cost fallback — we bias it to the US + filter to hits that
 * actually have a house number, so it feels professional even without
 * a paid backend.
 */

interface Suggestion {
  label: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_UA = "JRE Donation Form (office@thejre.org)";

const GOOGLE_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const GOOGLE_DETAILS_URL = "https://places.googleapis.com/v1/places";

const MAPBOX_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] as Suggestion[] });
  }

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  const mapboxKey = process.env.MAPBOX_ACCESS_TOKEN;

  try {
    if (googleKey) {
      const suggestions = await queryGoogle(q, googleKey);
      if (suggestions.length > 0) return NextResponse.json({ suggestions, provider: "google" });
    }
    if (mapboxKey) {
      const suggestions = await queryMapbox(q, mapboxKey);
      if (suggestions.length > 0) return NextResponse.json({ suggestions, provider: "mapbox" });
    }
    const suggestions = await queryNominatim(q);
    return NextResponse.json({ suggestions, provider: "nominatim" });
  } catch (err) {
    console.error("geocode route failed:", err);
    return NextResponse.json({ suggestions: [] as Suggestion[] });
  }
}

// ---------------- Google Places (New) ----------------

interface GoogleAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId: string;
      text: { text: string };
    };
  }>;
}

interface GooglePlaceDetails {
  formattedAddress?: string;
  addressComponents?: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }>;
}

async function queryGoogle(q: string, key: string): Promise<Suggestion[]> {
  const ac = await fetch(GOOGLE_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
    },
    body: JSON.stringify({
      input: q,
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      regionCodes: ["us"],
      languageCode: "en",
    }),
    next: { revalidate: 30 },
  });
  if (!ac.ok) return [];
  const data = (await ac.json()) as GoogleAutocompleteResponse;
  const predictions = (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is { placeId: string; text: { text: string } } => !!p);
  if (predictions.length === 0) return [];

  // Fetch structured details (up to 5 in parallel — stays within Google quota).
  const details = await Promise.all(
    predictions.slice(0, 5).map(async (p) => {
      try {
        const r = await fetch(`${GOOGLE_DETAILS_URL}/${p.placeId}`, {
          headers: {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "formattedAddress,addressComponents",
          },
          next: { revalidate: 60 },
        });
        if (!r.ok) return null;
        const d = (await r.json()) as GooglePlaceDetails;
        return parseGoogleDetails(d, p.text.text);
      } catch {
        return null;
      }
    }),
  );

  return details.filter((s): s is Suggestion => s !== null);
}

function parseGoogleDetails(d: GooglePlaceDetails, fallbackLabel: string): Suggestion {
  const by = (type: string, short = false): string => {
    const c = (d.addressComponents ?? []).find((x) => x.types.includes(type));
    return c ? (short ? c.shortText : c.longText) : "";
  };
  const streetNumber = by("street_number");
  const route = by("route");
  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim();
  return {
    label: d.formattedAddress || fallbackLabel,
    line1,
    city: by("locality") || by("sublocality") || by("administrative_area_level_2"),
    state: by("administrative_area_level_1", true),
    zip: by("postal_code"),
    country: by("country"),
  };
}

// ---------------- Mapbox ----------------

interface MapboxFeature {
  place_name: string;
  address?: string;
  text: string;
  context?: Array<{ id: string; text: string; short_code?: string }>;
}

async function queryMapbox(q: string, token: string): Promise<Suggestion[]> {
  const params = new URLSearchParams({
    access_token: token,
    country: "us",
    types: "address",
    autocomplete: "true",
    limit: "6",
  });
  const url = `${MAPBOX_URL}/${encodeURIComponent(q)}.json?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: MapboxFeature[] };
  return (data.features ?? []).map((f) => {
    const ctx = f.context ?? [];
    const part = (prefix: string): string =>
      ctx.find((c) => c.id.startsWith(prefix))?.text || "";
    const stateShort =
      ctx.find((c) => c.id.startsWith("region"))?.short_code?.replace(/^us-/i, "").toUpperCase() || "";
    const line1 = [f.address, f.text].filter(Boolean).join(" ").trim();
    return {
      label: f.place_name,
      line1,
      city: part("place") || part("locality"),
      state: stateShort || part("region"),
      zip: part("postcode"),
      country: part("country") || "United States",
    };
  });
}

// ---------------- OpenStreetMap Nominatim (fallback) ----------------

interface NominatimResult {
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

const US_STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL",
  Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
  Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI",
  Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT",
  Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX",
  Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

async function queryNominatim(q: string): Promise<Suggestion[]> {
  // Run two queries in parallel: a US-biased one (fast, targeted) and a
  // global one (fallback for international donors). Merge, dedupe by label.
  const run = async (countrycodes?: string): Promise<NominatimResult[]> => {
    const params = new URLSearchParams({
      q,
      format: "json",
      addressdetails: "1",
      limit: "8",
      "accept-language": "en",
    });
    if (countrycodes) params.set("countrycodes", countrycodes);
    const r = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { "User-Agent": NOMINATIM_UA, Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!r.ok) return [];
    return (await r.json()) as NominatimResult[];
  };

  const [usResults, allResults] = await Promise.all([run("us"), run()]);
  const combined = [...usResults, ...allResults];

  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const r of combined) {
    const a = r.address ?? {};
    // Skip purely street-level results with no house number — donors need
    // their actual street address for billing, not a road name.
    if (!a.house_number || !a.road) continue;
    const line1 = `${a.house_number} ${a.road}`.trim();
    const city = a.city || a.town || a.village || a.hamlet || a.suburb || "";
    const stateRaw = a.state || "";
    const state =
      a.country_code === "us" && stateRaw ? US_STATE_ABBR[stateRaw] ?? stateRaw : stateRaw;
    const key = `${line1}|${city}|${state}|${a.postcode || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      label: r.display_name,
      line1,
      city,
      state,
      zip: a.postcode || "",
      country: a.country || "",
    });
    if (suggestions.length >= 6) break;
  }
  return suggestions;
}
