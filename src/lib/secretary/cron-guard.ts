/**
 * Standard guards every JRE secretary cron route runs through:
 *   1. Bearer CRON_SECRET auth
 *   2. Shabbos/Yom Tov guard
 *   3. 25-second circuit breaker budget
 */

import { NextRequest, NextResponse } from "next/server";
import { shabbosGuard } from "@/lib/shabbos-guard";

export const CRON_MAX_DURATION = 60; // Vercel kill switch
export const CIRCUIT_BREAKER_MS = 25_000;

export function assertCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // local/dev
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function enforceShabbos(): NextResponse | null {
  const blocked = shabbosGuard();
  if (!blocked) return null;
  // shabbosGuard returns a Response; wrap in NextResponse for type.
  return NextResponse.json(
    { ok: true, skipped: true, reason: "Shabbos/Yom Tov guard" },
    { status: 200 }
  );
}

export class DeadlineError extends Error {
  constructor() { super("circuit breaker tripped"); }
}

export function withBudget<T>(
  budgetMs: number,
  task: () => Promise<T>
): Promise<T> {
  return Promise.race([
    task(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new DeadlineError()), budgetMs)
    ),
  ]);
}
