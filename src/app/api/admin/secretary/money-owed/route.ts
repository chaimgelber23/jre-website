/**
 * Admin CRUD for jre_money_owed.
 *
 * GET    — list all (default last 100)
 * POST   — add new item   { recipient_name, amount_usd, recipient_phone?, recipient_email?, reason?, payee_email? }
 * PATCH  — mark paid      { id, method?, reference? }
 * DELETE — cancel         ?id=...
 */
import { NextRequest, NextResponse } from "next/server";
import {
  listAllMoneyOwed,
  listOpenMoneyOwed,
  addMoneyOwed,
  markMoneyOwedPaid,
} from "@/lib/secretary/money-owed";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const openOnly = url.searchParams.get("open") === "1";
  const items = openOnly ? await listOpenMoneyOwed() : await listAllMoneyOwed();
  const totalOpen = items.filter((i) => i.status === "open").reduce((s, i) => s + i.amount_usd, 0);
  return NextResponse.json({ items, count: items.length, totalOpenUsd: totalOpen });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.recipient_name || !body.amount_usd) {
      return NextResponse.json({ error: "recipient_name and amount_usd required" }, { status: 400 });
    }
    const item = await addMoneyOwed(body);
    if (!item) return NextResponse.json({ error: "insert failed" }, { status: 500 });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await markMoneyOwedPaid(body.id, {
      method: body.method,
      reference: body.reference,
      source: "admin",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  await supabase.from("jre_money_owed").update({ status: "cancelled" }).eq("id", id);
  return NextResponse.json({ ok: true });
}
