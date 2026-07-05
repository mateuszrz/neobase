import type { Metadata } from "next";
import { Highlight } from "@/components/ui";

export const metadata: Metadata = {
  title: "Market Monitoring",
  description: "Daily competitive monitoring for a country and your key competitors, with AI summaries.",
};

const PLANS = [
  { name: "Starter", price: "€49", per: "/mo", feats: ["1 country", "3 competitors", "Daily data", "Weekly AI digest"] },
  { name: "Pro", price: "€149", per: "/mo", feats: ["3 countries", "10 competitors", "Daily data", "Daily + weekly AI digest", "Price & plan change alerts"], featured: true },
  { name: "Scale", price: "Custom", per: "", feats: ["Custom countries", "Unlimited competitors", "API access", "Priority support"] },
];

export default function MonitoringPage() {
  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 900 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>Monitoring</p>
        <h1 className="display">
          Monitor a market and its <Highlight>competitors</Highlight> — daily.
        </h1>
        <p className="lead" style={{ marginTop: 20, maxWidth: 620 }}>
          Choose a country and the competitors that matter. NeoBase tracks their ratings, reviews,
          sentiment, pricing and media coverage every day, and Claude summarises what changed.
        </p>

        <div className="grid grid-3" style={{ marginTop: 40, alignItems: "start" }}>
          {PLANS.map((p) => (
            <div key={p.name} className="card" style={p.featured ? { borderColor: "var(--cyan-signal)", boxShadow: "var(--shadow-xl)" } : undefined}>
              <div className="spread">
                <h2 className="subheading">{p.name}</h2>
                {p.featured && <span className="pill pill-score">Popular</span>}
              </div>
              <p style={{ margin: "12px 0 16px" }}>
                <span className="display" style={{ fontSize: "2rem" }}>{p.price}</span>
                <span className="muted">{p.per}</span>
              </p>
              <div className="stack-8" style={{ marginBottom: 20 }}>
                {p.feats.map((f) => (
                  <div key={f} className="row" style={{ gap: 8, fontSize: 14 }}>
                    <span style={{ color: "var(--cyan-signal)" }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <a className={`btn ${p.featured ? "btn-cyan" : "btn-ghost"}`} href="#" style={{ width: "100%", justifyContent: "center" }}>
                {p.price === "Custom" ? "Contact us" : "Start free trial"}
              </a>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 24, fontSize: 13 }}>
          Billing via Paddle. Pricing shown is indicative — checkout wiring lands in a later phase.
        </p>
      </div>
    </main>
  );
}
