import { getTranslations } from "next-intl/server";
import type { BrandTrend } from "@/lib/projects/data";
import { Sparkline, Delta } from "@/components/ui";

/* Per-brand composite-sentiment trend (sparkline + current score + period Δ) for
 * the tracked brands. Server component. Renders nothing until at least one brand
 * has ≥2 weekly points. */

export async function ProjectTrend({ trends }: { trends: BrandTrend[] }) {
  const t = await getTranslations("panel");
  const withData = trends.filter((b) => b.points.length >= 2);
  if (withData.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: 20, padding: 24 }}>
      <h2 className="subheading" style={{ marginBottom: 4 }}>{t("trendTitle")}</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
        {t("trendHint", { weeks: Math.max(...withData.map((b) => b.points.length)) })}
      </p>
      <div className="stack-16">
        {withData.map((b) => {
          const pts = b.points.map((p) => p.composite);
          const now = pts[pts.length - 1];
          const delta = Math.round((now - pts[0]) * 10) / 10;
          return (
            <div key={b.id} className="row" style={{ gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div className="row" style={{ gap: 8, alignItems: "center", minWidth: 130, flex: 1 }}>
                {b.logoSvg ? (
                  <img src={b.logoSvg} alt="" style={{ width: 20, height: 20, borderRadius: 5 }} />
                ) : (
                  <span style={{ width: 20, height: 20, borderRadius: 5, background: "var(--stone-border)" }} />
                )}
                <strong style={{ fontSize: 14 }}>{b.name}</strong>
              </div>
              <Sparkline values={pts} />
              <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.1rem" }}>{now.toFixed(0)}</span>
                <span className="muted" style={{ fontSize: 12 }}>/ 100</span>
                <Delta value={delta} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
