import { getTranslations } from "next-intl/server";
import type { ProjectSignals } from "@/lib/projects/data";
import { Delta, fmt } from "@/components/ui";

/* Project intelligence view: a brand × market signals matrix (latest rating,
 * sentiment, volume + Δ vs prior) and a recent-changes feed. Server component. */

const CHANGE_KEY: Record<string, string> = { price: "changePrice", feature: "changeFeature", offer: "changeOffer", copy: "changeCopy" };

async function Cell({ m }: { m: ProjectSignals["brands"][number]["markets"][number] }) {
  const t = await getTranslations();
  return (
    <div className="row" style={{ gap: 10, padding: "8px 0", borderBottom: "1px solid var(--stone-border)", alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ width: 128, fontSize: 14, fontWeight: 500 }}>{m.country}</span>
      {m.rating != null ? (
        <>
          <span style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{m.rating.toFixed(2)} ★</span>
          <Delta value={m.delta} />
          <span className="muted" style={{ fontSize: 13 }}>
            {m.pos != null ? t("ui.percentPositive", { pct: m.pos.toFixed(0) }) : "-"}
            {m.count != null ? ` · ${t("ui.ratingsCount", { count: fmt(m.count) })}` : ""}
          </span>
        </>
      ) : (
        <span className="muted" style={{ fontSize: 13 }}>{t("panel.pdCollecting")}</span>
      )}
    </div>
  );
}

export async function ProjectData({ signals }: { signals: ProjectSignals }) {
  const t = await getTranslations("panel");
  const { brands, changes } = signals;
  const hasCoverage = brands.length > 0 && brands[0].markets.length > 0;

  return (
    <>
      <div className="card" style={{ marginTop: 20, padding: 24 }}>
        <h2 className="subheading" style={{ marginBottom: 4 }}>{t("pdLatest")}</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
          {t("pdLatestHint")}
        </p>
        {!hasCoverage ? (
          <p className="muted" style={{ margin: 0 }}>{t("pdNoCoverage")}</p>
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
        <h2 className="subheading" style={{ marginBottom: 12 }}>{t("pdChanges")}</h2>
        {changes.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t("pdNoChanges")}
          </p>
        ) : (
          <div className="stack-16">
            {changes.map((c, i) => (
              <div key={i} style={{ paddingBottom: 14, borderBottom: i < changes.length - 1 ? "1px solid var(--stone-border)" : "none" }}>
                <div className="row" style={{ gap: 8, marginBottom: 4, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{c.name}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>{c.country} · {c.toDate}</span>
                  {c.changeKinds.map((k) => (
                    <span key={k} className="pill pill-neutral" style={{ fontSize: 11 }}>{CHANGE_KEY[k] ? t(CHANGE_KEY[k]) : k}</span>
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
