import type { ProjectSignals } from "@/lib/projects/data";
import { Delta, fmt, flagEmoji } from "@/components/ui";

/* Project intelligence view: a brand × market signals matrix (latest rating,
 * sentiment, volume + Δ vs prior) and a recent-changes feed. Server component. */

const CHANGE_LABEL: Record<string, string> = { price: "Pricing", feature: "Feature", offer: "Offer", copy: "Copy" };

function Cell({ m }: { m: ProjectSignals["brands"][number]["markets"][number] }) {
  return (
    <div className="row" style={{ gap: 10, padding: "8px 0", borderBottom: "1px solid var(--stone-border)", alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ width: 128, fontSize: 14 }}>
        <span aria-hidden>{flagEmoji(m.country)}</span> {m.country}
      </span>
      {m.rating != null ? (
        <>
          <span style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{m.rating.toFixed(2)} ★</span>
          <Delta value={m.delta} />
          <span className="muted" style={{ fontSize: 13 }}>
            {m.pos != null ? `${m.pos.toFixed(0)}% positive` : "—"}
            {m.count != null ? ` · ${fmt(m.count)} ratings` : ""}
          </span>
        </>
      ) : (
        <span className="muted" style={{ fontSize: 13 }}>Collecting — appears after the next daily run.</span>
      )}
    </div>
  );
}

export function ProjectData({ signals }: { signals: ProjectSignals }) {
  const { brands, changes } = signals;
  const hasCoverage = brands.length > 0 && brands[0].markets.length > 0;

  return (
    <>
      <div className="card" style={{ marginTop: 20, padding: 24 }}>
        <h2 className="subheading" style={{ marginBottom: 4 }}>Latest signals</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
          Trustpilot rating, sentiment and volume per brand × market — updated daily, with the change vs the prior day.
        </p>
        {!hasCoverage ? (
          <p className="muted" style={{ margin: 0 }}>Add brands and markets above to start collecting signals.</p>
        ) : (
          <div className="stack-16">
            {brands.map((b) => (
              <div key={b.id}>
                <div className="row" style={{ gap: 8, marginBottom: 4, alignItems: "center" }}>
                  {b.logoSvg ? (
                    <img src={b.logoSvg} alt="" style={{ width: 20, height: 20, borderRadius: 5 }} />
                  ) : (
                    <span style={{ width: 20, height: 20, borderRadius: 5, background: "var(--stone-border)" }} />
                  )}
                  <strong>{b.name}</strong>
                </div>
                {b.markets.map((m) => (
                  <Cell key={m.country} m={m} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 20, padding: 24 }}>
        <h2 className="subheading" style={{ marginBottom: 12 }}>Recent changes</h2>
        {changes.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No competitor changes detected yet — pricing, plan and homepage moves across your tracked brands appear here as the daily crawl runs.
          </p>
        ) : (
          <div className="stack-16">
            {changes.map((c, i) => (
              <div key={i} style={{ paddingBottom: 14, borderBottom: i < changes.length - 1 ? "1px solid var(--stone-border)" : "none" }}>
                <div className="row" style={{ gap: 8, marginBottom: 4, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{c.name}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>{flagEmoji(c.country)} {c.country} · {c.toDate}</span>
                  {c.changeKinds.map((k) => (
                    <span key={k} className="pill pill-neutral" style={{ fontSize: 11 }}>{CHANGE_LABEL[k] ?? k}</span>
                  ))}
                </div>
                {c.summary && <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{c.summary}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
