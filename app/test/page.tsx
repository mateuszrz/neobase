import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { generateReport } from "@/lib/report/generate";
import { clientIp, withinRateLimit, RATE_MAX, RATE_WINDOW_MIN } from "@/lib/report/rate-limit";

export const metadata: Metadata = {
  title: "Test our reports — free weekly competitive brief",
  description:
    "Enter your brand and a few competitors and get a free weekly competitive-intelligence brief — grounded in real ratings, sentiment and media data.",
};

export default async function TestReportPage({ searchParams }: { searchParams: Promise<{ slow?: string }> }) {
  const { slow } = await searchParams;

  async function run(formData: FormData) {
    "use server";
    const brand = String(formData.get("brand") ?? "").trim();
    if (!brand) return;
    const competitors = String(formData.get("competitors") ?? "")
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8); // cap the fan-out

    const ip = await clientIp();
    if (!(await withinRateLimit(ip))) redirect("/test/?slow=1");

    const { id } = await generateReport(brand, competitors, ip);
    redirect(`/test/${id}`);
  }

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>Free test</p>
        <h1 className="display" style={{ fontSize: "2.4rem" }}>
          See a weekly competitive brief on <span className="hl">your brand</span>.
        </h1>
        <p className="lead" style={{ marginTop: 18, marginBottom: 32, maxWidth: 560 }}>
          Tell us your brand and a few competitors. We build a weekly competitive-intelligence
          report — ratings, sentiment, media and strategic signals — and show you the executive
          summary free. No account, no card.
        </p>

        {slow && (
          <p
            className="stack-8"
            style={{ padding: "12px 16px", borderRadius: 8, marginBottom: 20, background: "var(--stone-canvas)", border: "1px solid var(--neg)", color: "var(--neg)", fontSize: 14, lineHeight: 1.6 }}
          >
            You&apos;ve generated a few briefs in a short window (limit {RATE_MAX} per {RATE_WINDOW_MIN} minutes).
            Give it a little while and try again — or <a href="/monitoring/" style={{ color: "inherit", textDecoration: "underline" }}>talk to us</a> for unlimited reports.
          </p>
        )}

        <form action={run} className="card stack-16" style={{ padding: 24 }}>
          <label className="stack-8" style={{ display: "block" }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>Your brand</span>
            <input
              name="brand"
              required
              placeholder="e.g. ZEN.COM"
              autoComplete="organization"
              style={inputStyle}
            />
          </label>

          <label className="stack-8" style={{ display: "block" }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>Competitors</span>
            <textarea
              name="competitors"
              rows={4}
              placeholder="One per line or comma-separated&#10;e.g. Revolut, Wise, Monzo, N26"
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
            <span className="muted" style={{ fontSize: 12 }}>
              Domains or names. Up to 8 — we match them to brands we already track.
            </span>
          </label>

          <button className="btn btn-cyan" type="submit" style={{ justifyContent: "center" }}>
            Build my free brief →
          </button>
        </form>

        <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
          Grounded in real cross-platform ratings and customer-sentiment data — we never invent
          events. Media &amp; social tracking deepens the brief on a paid project.
        </p>
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid var(--stone-border, #e5e0d8)",
  fontSize: 15,
  background: "var(--stone-canvas, #fff)",
} as const;
