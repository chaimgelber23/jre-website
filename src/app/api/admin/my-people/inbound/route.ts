import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const INBOUND_SECRET = process.env.MY_PEOPLE_INBOUND_SECRET || "";

/**
 * POST /api/admin/my-people/inbound
 *
 * Called by Google Apps Script watching people@thejre.org.
 *
 * Email format:
 *   Subject: Person's name
 *   Body: Any notes (phone numbers and emails auto-extracted)
 *
 * Shorthand — just the subject line is enough:
 *   Subject: "David Cohen - met at shabbos at the Schwartz's"
 */
export async function POST(req: NextRequest) {
  // Verify secret
  const secret = req.headers.get("x-inbound-secret");
  if (INBOUND_SECRET && secret !== INBOUND_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { from, subject, body: emailBody } = body;

  if (!subject && !emailBody) {
    return NextResponse.json({ error: "Need subject or body" }, { status: 400 });
  }

  // Parse the email
  const fullText = `${subject || ""}\n${emailBody || ""}`.trim();

  // Name = subject line (strip "Re:", "Fwd:", etc.)
  let name = (subject || "")
    .replace(/^(re|fwd|fw):\s*/gi, "")
    .trim();

  // If subject has " - " split into name and context
  let context = "";
  const dashSplit = name.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashSplit) {
    name = dashSplit[1].trim();
    context = dashSplit[2].trim();
  }

  // If no subject, take first line of body as name
  if (!name && emailBody) {
    const lines = emailBody.trim().split("\n");
    name = lines[0].trim();
  }

  if (!name) {
    return NextResponse.json({ error: "Could not determine name" }, { status: 400 });
  }

  // Extract phone numbers from body
  const phoneMatch = (emailBody || "").match(
    /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\+\d{10,})/
  );
  const phone = phoneMatch ? phoneMatch[0] : null;

  // Extract email addresses from body
  const emailMatch = (emailBody || "").match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  const email = emailMatch ? emailMatch[0] : null;

  // Detect how_met from keywords
  const lowerText = fullText.toLowerCase();
  let how_met = "other";
  if (/shabb[oa]s|shabbat|friday night|seuda/i.test(lowerText)) how_met = "shabbos";
  else if (/event|dinner|gala|program|class/i.test(lowerText)) how_met = "event";
  else if (/shul|daven|minyan|kiddush/i.test(lowerText)) how_met = "shul";
  else if (/friend|intro|introduced|connect/i.test(lowerText)) how_met = "mutual_friend";
  else if (/community|neighbor|park|store/i.test(lowerText)) how_met = "community";
  else if (/work|office|business|professional/i.test(lowerText)) how_met = "work";

  // Build notes from body (exclude the extracted phone/email)
  let notes = (emailBody || context || "").trim();
  // Clean up common email signatures
  notes = notes.replace(/^sent from .*/im, "").trim();
  // Don't store empty notes
  if (!notes) notes = context || null;

  // Detect location
  let location: string | null = null;
  const atMatch = fullText.match(/(?:at|@)\s+(?:the\s+)?(\w[\w\s']+?)(?:\s*[,.\n]|$)/i);
  if (atMatch && !["the", "a", "an"].includes(atMatch[1].toLowerCase().trim())) {
    location = atMatch[1].trim();
  }

  // Insert into personal_contacts
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("personal_contacts")
    .insert({
      name,
      phone,
      email,
      how_met,
      location,
      notes,
      date_met: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    contact: { name, how_met, phone, email, location },
    message: `Added ${name} to your list`,
  });
}
