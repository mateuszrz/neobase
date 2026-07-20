import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Highlight } from "@/components/ui";
import { routing } from "@/i18n/routing";
import { alternates } from "@/lib/i18n/alternates";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "monitoring" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: alternates(locale, "/monitoring/"),
  };
}

export default async function MonitoringPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("monitoring");

  // Plan copy comes from the catalog: prices are literals, everything else is a
  // message key, so a locale can't end up with a Polish page and English tiers.
  const plans = [
    { key: "starter", name: t("starter"), price: "€49", per: t("perMonth"), feats: [t("f1Country"), t("f3Competitors"), t("fDailyData"), t("fWeeklyDigest")] },
    { key: "pro", name: t("pro"), price: "€149", per: t("perMonth"), featured: true, feats: [t("f3Countries"), t("f10Competitors"), t("fDailyData"), t("fDailyWeeklyDigest"), t("fAlerts")] },
    { key: "scale", name: t("scale"), price: t("priceCustom"), per: "", feats: [t("fCustomCountries"), t("fUnlimitedCompetitors"), t("fApi"), t("fPriority")] },
  ];

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 900 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>{t("eyebrow")}</p>
        <h1 className="display">{t.rich("headline", { hl: (c) => <Highlight>{c}</Highlight> })}</h1>
        <p className="lead" style={{ marginTop: 20, maxWidth: 620 }}>{t("lead")}</p>

        <div className="grid grid-3" style={{ marginTop: 40, alignItems: "start" }}>
          {plans.map((p) => (
            <div key={p.key} className="card" style={p.featured ? { borderColor: "var(--cyan-signal)", boxShadow: "var(--shadow-xl)" } : undefined}>
              <div className="spread">
                <h2 className="subheading">{p.name}</h2>
                {p.featured && <span className="pill pill-score">{t("popular")}</span>}
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
                {p.key === "scale" ? t("contactUs") : t("startTrial")}
              </a>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 24, fontSize: 13 }}>{t("billingNote")}</p>
      </div>
    </main>
  );
}
