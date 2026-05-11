// Styles for the embed widget. The slug param isn't used in the CSS content
// itself — the file is identical per campaign — but keeping it nested under
// /embed/[slug]/widget.css keeps the URL symmetry of /embed/[slug]/widget.js.

export const runtime = "nodejs";

const CSS = `/*! JRE Campaign Embed Widget — styles */
.jre-embed-root {
  --jre-embed-color: #EF8046;
  --jre-embed-bg: #ffffff;
  --jre-embed-fg: #111827;
  --jre-embed-muted: #6b7280;
  --jre-embed-border: #e5e7eb;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  color: var(--jre-embed-fg);
  max-width: 360px;
  box-sizing: border-box;
}
.jre-embed-root * { box-sizing: border-box; }

.jre-embed-card {
  background: var(--jre-embed-bg);
  border: 1px solid var(--jre-embed-border);
  border-radius: 12px;
  padding: 20px 22px 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 8px 24px rgba(0,0,0,0.06);
}

.jre-embed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  min-height: 18px;
}
.jre-embed-label {
  display: inline-block;
  padding: 3px 8px;
  background: rgba(16,185,129,0.12);
  color: #047857;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  border-radius: 4px;
}
.jre-embed-label::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
  animation: jre-embed-pulse 1.6s ease-in-out infinite;
}
@keyframes jre-embed-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.jre-embed-match {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--jre-embed-color);
}

.jre-embed-progress {
  height: 8px;
  background: #f3f4f6;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 14px;
}
.jre-embed-bar {
  height: 100%;
  background: var(--jre-embed-color);
  border-radius: 999px;
  transition: width 600ms ease-out;
}

.jre-embed-stats { margin-bottom: 16px; }
.jre-embed-raised {
  font-size: 22px;
  font-weight: 700;
  color: var(--jre-embed-fg);
  letter-spacing: -0.5px;
  line-height: 1.2;
}
.jre-embed-goal {
  font-size: 12px;
  color: var(--jre-embed-muted);
  margin-top: 2px;
}

.jre-embed-cta {
  display: block;
  width: 100%;
  text-align: center;
  padding: 12px 18px;
  background: var(--jre-embed-color);
  color: #ffffff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.3px;
  border-radius: 8px;
  transition: filter 150ms ease-out, transform 150ms ease-out;
}
.jre-embed-cta:hover {
  filter: brightness(0.94);
  transform: translateY(-1px);
}
.jre-embed-cta:active { transform: translateY(0); }

.jre-embed-footer {
  margin-top: 10px;
  text-align: center;
}
.jre-embed-footer a {
  font-size: 10px;
  color: var(--jre-embed-muted);
  text-decoration: none;
  letter-spacing: 0.4px;
}
.jre-embed-footer a:hover { color: var(--jre-embed-fg); }
`;

export async function GET() {
  return new Response(CSS, {
    status: 200,
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
      "Vary": "Origin",
    },
  });
}
