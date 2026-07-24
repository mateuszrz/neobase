import { getTranslations } from "next-intl/server";

/* Aggregate insights for the MiCA/ESMA CASP register, computed live from the
 * registry rows (no stored stats — always in sync with the data). Service names
 * are the canonical ESMA data values (same as the registry filter), so they stay
 * untranslated; the surrounding chrome + insight sentences are localized. */

export interface MicaInsightsData {
  total: number;
  countries: number;
  services: { name: string; count: number }[]; // sorted desc
  regulators: { regulator: string; country: string; count: number }[]; // top N, sorted desc
  tradingPlatforms: number;
  singleService: number;
}

export async function MicaInsights({ data }: { data: MicaInsightsData }) {
  const t = await getTranslations("micaPage");
  const maxSvc = Math.max(1, ...data.services.map((s) => s.count));
  const maxReg = Math.max(1, ...data.regulators.map((r) => r.count));
  const top = data.regulators[0];

  return (
    <section style={{ marginTop: 40 }}>
      <h2 className="h-sm" style={{ fontSize: "1.4rem", marginBottom: 6 }}>{t("insightsTitle")}</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 22, maxWidth: 720 }}>
        {t("insightTradingPlatform", { count: data.tradingPlatforms, total: data.total })}{" "}
        {t("insightSingleService", { count: data.singleService })}
      </p>

      <div className="row" style={{ gap: 40, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 320px", minWidth: 300 }}>
          <h3 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--warm-gray)", marginBottom: 12 }}>
            {t("byServiceTitle")}
          </h3>
          {data.services.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
              <span style={{ flex: "0 0 130px", fontSize: 12.5 }}>{s.name}</span>
              <span style={{ flex: 1, height: 8, background: "var(--stone-border)", borderRadius: 4, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${(s.count / maxSvc) * 100}%`, background: "var(--cyan-edge)", borderRadius: 4 }} />
              </span>
              <span style={{ flex: "0 0 34px", textAlign: "right", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{s.count}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: "1 1 280px", minWidth: 260 }}>
          <h3 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--warm-gray)", marginBottom: 12 }}>
            {t("byRegulatorTitle")}
          </h3>
          {data.regulators.map((r) => (
            <div key={`${r.regulator}-${r.country}`} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
              <span style={{ flex: "0 0 150px", fontSize: 12.5 }}>{r.regulator} <span className="muted">· {r.country}</span></span>
              <span style={{ flex: 1, height: 8, background: "var(--stone-border)", borderRadius: 4, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${(r.count / maxReg) * 100}%`, background: "var(--cyan-edge)", borderRadius: 4 }} />
              </span>
              <span style={{ flex: "0 0 34px", textAlign: "right", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{r.count}</span>
            </div>
          ))}
          {top && (
            <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              {t("insightTopRegulator", { regulator: top.regulator, country: top.country, count: top.count })}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
