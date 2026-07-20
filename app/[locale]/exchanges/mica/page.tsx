import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { alternates } from "@/lib/i18n/alternates";
import { getMicaRegistry } from "@/lib/queries";
import { MicaRegistry } from "@/components/MicaRegistry";

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

  return (
    <main className="section" style={{ paddingTop: 24 }}>
      <div className="wrap">
        <p style={{ fontSize: 13, marginBottom: 12 }}>
          <Link href="/exchanges/" style={{ color: "var(--cyan-edge)" }}>← {t("backExchanges")}</Link>
        </p>
        <p className="eyebrow" style={{ marginBottom: 10 }}>{t("eyebrow")}</p>
        <h1 className="h-sm">{t("title")}</h1>
        <p className="lead" style={{ marginTop: 10, marginBottom: 20, maxWidth: 780 }}>
          The EU register of crypto-asset service providers (CASPs) authorised under MiCA, mirrored from ESMA.
          Search by name, country, regulator or service — and see the licensed exchanges we track ranked by our own
          customer-sentiment score.
        </p>

        <div className="row" style={{ gap: 28, flexWrap: "wrap", marginBottom: 24 }}>
          <Stat n={rows.length} label={t("statProviders")} />
          <Stat n={countries} label={t("statCountries")} />
          <Stat n={regulators} label={t("statRegulators")} />
          <Stat n={tradingPlatforms} label={t("statTradingPlatforms")} />
          <Stat n={tracked} label={t("statRanked")} />
        </div>

        <MicaRegistry rows={rows} />

        <p className="muted" style={{ fontSize: 11, marginTop: 20 }}>
          Source: ESMA MiCA register. NeoBase mirrors the public data and adds its own sentiment ranking; verify
          critical decisions against the official ESMA register and the relevant national regulator.
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
