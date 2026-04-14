import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  const correctPin = process.env.MY_PEOPLE_PIN || "1818";

  if (pin === correctPin) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
}
