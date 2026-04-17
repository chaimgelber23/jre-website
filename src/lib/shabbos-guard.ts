/**
 * Shabbos & Yom Tov Guard
 *
 * Prevents JRE automation from firing during Shabbos and Yom Tov.
 * Sundown-to-sundown, Hebrew calendar based.
 *
 * Requires: @hebcal/core (run `npm install @hebcal/core` after first pull).
 *
 * Configure location via env vars (defaults to White Plains, NY where JRE runs):
 *   SHABBOS_GUARD_LAT  (default: 41.0340)
 *   SHABBOS_GUARD_LNG  (default: -73.7629)
 *   SHABBOS_GUARD_TZID (default: America/New_York)
 */

import { GeoLocation, Zmanim, HebrewCalendar, HDate, flags } from "@hebcal/core";

const DEFAULT_LAT = 41.034;   // White Plains, NY
const DEFAULT_LNG = -73.7629;
const DEFAULT_TZID = "America/New_York";

function getLocation() {
  const lat = parseFloat(process.env.SHABBOS_GUARD_LAT || "") || DEFAULT_LAT;
  const lng = parseFloat(process.env.SHABBOS_GUARD_LNG || "") || DEFAULT_LNG;
  const tzid = process.env.SHABBOS_GUARD_TZID || DEFAULT_TZID;
  return { lat, lng, tzid };
}

function getSunset(date: Date, lat: number, lng: number, tzid: string): Date {
  const gloc = new GeoLocation(null, lat, lng, 0, tzid);
  const zman = new Zmanim(gloc, date, false);
  return zman.sunset();
}

function isKodeshDay(date: Date): { yomTov: boolean; cholHamoed: boolean } {
  const hd = new HDate(date);
  const events = HebrewCalendar.calendar({
    start: hd,
    end: hd,
    noMinorFast: true,
    noModern: true,
    noRoshChodesh: true,
    noSpecialShabbat: true,
  });
  let yomTov = false;
  let cholHamoed = false;
  for (const ev of events) {
    const mask = ev.getFlags();
    if (mask & flags.CHAG) yomTov = true;
    if (mask & flags.CHOL_HAMOED) cholHamoed = true;
  }
  return { yomTov, cholHamoed };
}

function getLocalDate(dt: Date, tzid: string): Date {
  const str = dt.toLocaleDateString("en-US", { timeZone: tzid });
  return new Date(str);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const CANDLE_MS = 18 * 60 * 1000;       // 18 min before sunset
const HAVDALAH_MS = 50 * 60 * 1000;     // 50 min after sunset (R"T safety)

export function isShabbosOrYomTov(now?: Date): { blocked: boolean; reason?: string } {
  const { lat, lng, tzid } = getLocation();
  const currentTime = now || new Date();
  const today = getLocalDate(currentTime, tzid);

  for (let offset = -1; offset <= 2; offset++) {
    const day = addDays(today, offset);
    const dayOfWeek = day.getDay();
    const isShabbos = dayOfWeek === 6;
    const { yomTov: isYomTov, cholHamoed: isCholHamoed } = isKodeshDay(day);

    if (!isShabbos && !isYomTov && !isCholHamoed) continue;

    const erev = addDays(day, -1);
    const erevSunset = getSunset(erev, lat, lng, tzid);
    const daySunset = getSunset(day, lat, lng, tzid);

    const windowStart = new Date(erevSunset.getTime() - CANDLE_MS);
    const windowEnd = new Date(daySunset.getTime() + HAVDALAH_MS);

    if (currentTime >= windowStart && currentTime <= windowEnd) {
      const label =
        isShabbos && isYomTov
          ? "Shabbos & Yom Tov"
          : isShabbos
          ? "Shabbos"
          : isYomTov
          ? "Yom Tov"
          : "Chol HaMoed";
      return { blocked: true, reason: label };
    }
  }

  return { blocked: false };
}

/**
 * Cron-route helper. Returns a skip Response if blocked, or null to proceed.
 */
export function shabbosGuard(now?: Date): Response | null {
  const { blocked, reason } = isShabbosOrYomTov(now);
  if (blocked) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: `Shabbos/Yom Tov guard: ${reason}`,
    });
  }
  return null;
}
