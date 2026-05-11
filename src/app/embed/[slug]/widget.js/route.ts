import { NextRequest } from "next/server";
import { getCampaignBySlug } from "@/lib/campaign";

// The embed widget is a single self-contained vanilla JS file that:
//  - Injects /embed/[slug]/widget.css into the host page
//  - Finds mount elements via [data-jre-campaign="<slug>"]
//  - Renders a thermometer + Donate button
//  - Polls /api/campaign/[slug]/progress every 30s (paused while tab hidden)
//  - Opens the donate modal in a new tab on click

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_COLOR = "#EF8046";

function siteOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  // Fallback to the incoming origin (preview deploys, localhost)
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host") || "thejre.org";
  return `${proto}://${host}`;
}

function escapeForJsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function isValidHexColor(s: string | null | undefined): s is string {
  return !!s && /^#[0-9a-fA-F]{3,8}$/.test(s);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const safeSlug = slug.replace(/[^a-z0-9-_]/gi, "");
  if (!safeSlug || safeSlug !== slug) {
    return new Response("// invalid slug", {
      status: 400,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  const campaign = await getCampaignBySlug(safeSlug);
  if (!campaign) {
    return new Response(`// campaign "${safeSlug}" not found`, {
      status: 404,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  const origin = siteOrigin(req);
  const defaultColor = isValidHexColor(campaign.theme_color)
    ? campaign.theme_color
    : FALLBACK_COLOR;

  const js = `/*! JRE Campaign Embed — ${escapeForJsString(campaign.title)} */
(function () {
  var SLUG = ${JSON.stringify(safeSlug)};
  var DEFAULT_COLOR = ${JSON.stringify(defaultColor)};
  var SITE = ${JSON.stringify(origin)};
  var API = SITE + "/api/campaign/" + SLUG + "/progress";
  var CAMPAIGN_URL = SITE + "/campaign/" + SLUG + "?donate=1&utm_source=embed";
  var STYLE_HREF = SITE + "/embed/" + SLUG + "/widget.css";
  var POLL_MS = 30000;

  function injectStyle() {
    if (document.getElementById("jre-embed-css-" + SLUG)) return;
    var link = document.createElement("link");
    link.id = "jre-embed-css-" + SLUG;
    link.rel = "stylesheet";
    link.href = STYLE_HREF;
    document.head.appendChild(link);
  }

  function fmtUsd(cents) {
    var dollars = Math.round((cents || 0) / 100);
    return "$" + dollars.toLocaleString("en-US");
  }

  function buildShell() {
    return ''
      + '<div class="jre-embed-card">'
      +   '<div class="jre-embed-header">'
      +     '<span class="jre-embed-label">Live</span>'
      +     '<span class="jre-embed-match" data-match></span>'
      +   '</div>'
      +   '<div class="jre-embed-progress"><div class="jre-embed-bar" data-bar style="width:0%"></div></div>'
      +   '<div class="jre-embed-stats">'
      +     '<div class="jre-embed-raised" data-raised>Loading…</div>'
      +     '<div class="jre-embed-goal" data-goal></div>'
      +   '</div>'
      +   '<a class="jre-embed-cta" href="' + CAMPAIGN_URL + '" target="_blank" rel="noopener noreferrer">Donate</a>'
      +   '<div class="jre-embed-footer">'
      +     '<a href="' + SITE + '/campaign/' + SLUG + '" target="_blank" rel="noopener noreferrer">powered by The JRE</a>'
      +   '</div>'
      + '</div>';
  }

  function paint(mount, snap) {
    if (!snap || !snap.progress) return;
    var raised = (snap.progress.raised_cents || 0) + (snap.progress.matched_cents || 0);
    var goal = snap.progress.goal_cents || 1;
    var pct = Math.min(100, (raised / goal) * 100);
    var bar = mount.querySelector("[data-bar]");
    var raisedEl = mount.querySelector("[data-raised]");
    var goalEl = mount.querySelector("[data-goal]");
    var matchEl = mount.querySelector("[data-match]");
    if (bar) bar.style.width = pct.toFixed(1) + "%";
    if (raisedEl) raisedEl.textContent = fmtUsd(raised) + " raised";
    if (goalEl) goalEl.textContent = "of " + fmtUsd(goal) + " goal · " + pct.toFixed(1) + "%";
    var matcher = snap.matchers && snap.matchers[0];
    if (matchEl) {
      if (matcher && matcher.is_active) {
        matchEl.textContent = (Number(matcher.multiplier) || 1) + "× MATCH";
        matchEl.style.display = "";
      } else {
        matchEl.style.display = "none";
      }
    }
  }

  function fetchOnce(mounts) {
    if (document.hidden) return;
    fetch(API, { credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) {
        if (!json || !json.success || !json.snapshot) return;
        mounts.forEach(function (m) { paint(m, json.snapshot); });
      })
      .catch(function () { /* transient — next tick */ });
  }

  function init() {
    injectStyle();
    var nodes = document.querySelectorAll('[data-jre-campaign="' + SLUG + '"]');
    if (!nodes.length) return;
    var mounts = [];
    nodes.forEach(function (node) {
      if (node.getAttribute("data-jre-mounted") === "1") return;
      node.setAttribute("data-jre-mounted", "1");
      var color = node.getAttribute("data-color");
      node.style.setProperty("--jre-embed-color", (color && /^#[0-9a-fA-F]{3,8}$/.test(color)) ? color : DEFAULT_COLOR);
      node.classList.add("jre-embed-root");
      node.innerHTML = buildShell();
      mounts.push(node);
    });
    if (!mounts.length) return;

    fetchOnce(mounts);
    setInterval(function () { fetchOnce(mounts); }, POLL_MS);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) fetchOnce(mounts);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
`;

  return new Response(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
      "Vary": "Origin",
    },
  });
}
