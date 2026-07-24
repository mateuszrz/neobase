import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { alternates } from "@/lib/i18n/alternates";
import { getMicaRegistry } from "@/lib/queries";
import { MicaRegistry } from "@/components/MicaRegistry";
import { MicaInsights } from "@/components/MicaInsights";
import { MicaFaq } from "@/components/MicaFaq";

export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "micaPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: alternates(locale, "/exchanges/mica/"),
  };
}

export default async function MicaRegistryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("micaPage");
  const rows = await getMicaRegistry();
  const countries = new Set(rows.map((r) => r.country)).size;
  const regulators = new Set(rows.map((r) => r.regulator)).size;
  const tradingPlatforms = rows.filter((r) => r.services.includes("Trading platform")).length;
  const tracked = rows.filter((r) => r.sentiment != null).length;

  const svcCounts = new Map<string, number>();
  const regCounts = new Map<string, { regulator: string; country: string; count: number }>();
  for (const r of rows) {
    for (const s of r.services) svcCounts.set(s, (svcCounts.get(s) ?? 0) + 1);
    const key = `${r.regulator}|${r.country}`;
    const cur = regCounts.get(key) ?? { regulator: r.regulator, country: r.country, count: 0 };
    cur.count++;
    regCounts.set(key, cur);
  }
  const insights = {
    total: rows.length,
    countries,
    tradingPlatforms,
    singleService: rows.filter((r) => r.services.length === 1).length,
    services: [...svcCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    regulators: [...regCounts.values()].sort((a, b) => b.count - a.count).slice(0, 8),
  };

  return (
    <main className="section" style={{ paddingTop: 24 }}>
      <div className="wrap">
        <p style={{ fontSize: 13, marginBottom: 12 }}>
          <Link href="/exchanges/" style={{ color: "var(--cyan-edge)" }}>← {t("backExchanges")}</Link>
        </p>
        <p className="eyebrow" style={{ marginBottom: 10 }}>{t("eyebrow")}</p>
        <h1 className="h-sm">{t("title")}</h1>
        <p className="lead" style={{ marginTop: 10, marginBottom: 20, maxWidth: 780 }}>
          {t("lead")}
        </p>

        <div className="row" style={{ gap: 28, flexWrap: "wrap", marginBottom: 24 }}>
          <Stat n={rows.length} label={t("statProviders")} />
          <Stat n={countries} label={t("statCountries")} />
          <Stat n={regulators} label={t("statRegulators")} />
          <Stat n={tradingPlatforms} label={t("statTradingPlatforms")} />
          <Stat n={tracked} label={t("statRanked")} />
        </div>

        <MicaRegistry rows={rows} />

        <MicaInsights data={insights} />

        <MicaFaq total={rows.length} countries={countries} tradingPlatforms={tradingPlatforms} />

        <p className="muted" style={{ fontSize: 11, marginTop: 44 }}>
          {t("sourceNote")}
        </p>
      </div>
    </main>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 500, lineHeight: 1 }}>{n}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{label}</div>
    </div>
  );
}
