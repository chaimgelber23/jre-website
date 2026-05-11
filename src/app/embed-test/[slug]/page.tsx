import type { Metadata } from "next";

// Verification page for the /embed/[slug]/widget.js product. Renders the
// embed snippet exactly as a charity client would paste it onto their own
// site (Squarespace / Wix / Webflow / WordPress). Lives on thejre.org but
// the fetch path through widget.js still cross-origin-roundtrips to
// /api/campaign/[slug]/progress because the widget treats SITE as a
// constant, not as document.location. That's the same code path a real
// embed runs through, so this page proves the CORS + cache behavior.
//
// Not linked from anywhere in the public IA. noindex.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Embed Test — The JRE",
  description: "Internal verification page for the campaign embed widget.",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function EmbedTestPage({ params }: Props) {
  const { slug } = await params;
  const snippetHtml = `<div data-jre-campaign="${slug}"></div>
<script async src="https://thejre.org/embed/${slug}/widget.js"></script>`;

  return (
    <main
      style={{
        maxWidth: 880,
        margin: "48px auto",
        padding: "0 24px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        color: "#111827",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.4px", marginBottom: 8 }}>
        Embed test — <code style={{ fontSize: 22 }}>{slug}</code>
      </h1>
      <p style={{ color: "#6b7280", marginBottom: 32, lineHeight: 1.6 }}>
        Verifies the campaign embed widget renders, polls live data, and the donate button opens
        the campaign page. Identical code path to what a charity client embeds on their own site.
      </p>

      <section
        style={{
          padding: 24,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          marginBottom: 32,
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>
          Snippet (what the client pastes)
        </h2>
        <pre
          style={{
            background: "#111827",
            color: "#f9fafb",
            padding: 16,
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.6,
            overflowX: "auto",
            margin: 0,
            fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
          }}
        >
          {snippetHtml}
        </pre>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px" }}>
          Default theme (from campaign theme_color)
        </h2>
        <div data-jre-campaign={slug} />
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px" }}>
          Override theme (data-color=&ldquo;#0F1E3B&rdquo;)
        </h2>
        <div data-jre-campaign={slug} data-color="#0F1E3B" />
      </section>

      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 64, paddingTop: 24, borderTop: "1px solid #e5e7eb" }}>
        Internal verification surface · noindex · /embed-test/{slug}
      </p>

      <script async src={`/embed/${slug}/widget.js`} />
    </main>
  );
}
