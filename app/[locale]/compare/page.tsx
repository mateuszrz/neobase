import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { alternates } from "@/lib/i18n/alternates";
import { featuredComparisons, type FeaturedComparison } from "@/lib/compare";
import { BrandLogo } from "@/components/BrandLogo";

export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "compare" });
  return {
    title: t("indexTitle"),
    description: t("indexDesc"),
    alternates: alternates(locale, "/compare/"),
  };
}

function PairCard({ c, kind, cta, vs }: { c: FeaturedComparison; kind: "fintech" | "exchange"; cta: string; vs: string }) {
  return (
    <Link href={`/compare/${c.pair}/`} className="card card-tight" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <BrandLogo src={c.a.logoSvg} website={c.a.website} name={c.a.name} size={26} />
        <span className="muted" style={{ fontSize: 12 }}>{vs}</span>
        <BrandLogo src={c.b.logoSvg} website={c.b.website} name={c.b.name} size={26} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.a.name} {vs} {c.b.name}</div>
      <div style={{ color: "var(--cyan-edge)", fontSize: 13, marginTop: 4 }}>{cta}</div>
    </Link>
  );
}

export default async function CompareIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("compare");
  const { neobank, exchange } = await featuredComparisons();

  return (
    <main className="section" style={{ paddingTop: 24 }}>
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 10 }}>{t("indexHeading")}</p>
        <h1 className="h-sm">{t("indexTitle")}</h1>
        <p className="lead" style={{ marginTop: 10, marginBottom: 32, maxWidth: 760 }}>{t("indexLead")}</p>

        {neobank.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <div className="spread" style={{ marginBottom: 14, alignItems: "baseline" }}>
              <h2 className="subheading">{t("popularNeobanks")}</h2>
              <Link href="/neobanks/" style={{ color: "var(--cyan-edge)", fontSize: 13 }}>{t("browseNeobanks")}</Link>
            </div>
            <div className="grid grid-4">
              {neobank.map((c) => <PairCard key={c.pair} c={c} kind="fintech" cta={t("compareCta")} vs={t("vs")} />)}
            </div>
          </section>
        )}

        {exchange.length > 0 && (
          <section>
            <div className="spread" style={{ marginBottom: 14, alignItems: "baseline" }}>
              <h2 className="subheading">{t("popularExchanges")}</h2>
              <Link href="/exchanges/" style={{ color: "var(--cyan-edge)", fontSize: 13 }}>{t("browseExchanges")}</Link>
            </div>
            <div className="grid grid-4">
              {exchange.map((c) => <PairCard key={c.pair} c={c} kind="exchange" cta={t("compareCta")} vs={t("vs")} />)}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
