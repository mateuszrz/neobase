import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPlatformStats, getTopNeobanks, getTopExchanges } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { alternates } from "@/lib/i18n/alternates";
import { FintechCard, Highlight, Stat, fmt } from "@/components/ui";

export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Title and description come from the layout's defaults; this exists purely for
 * the canonical + hreflang set. The homepage is the most linked page on the
 * site, so leaving it as the one page with no alternates would hide the whole
 * language set from crawlers arriving at the root.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternates(locale, "/") };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const [stats, neobanks, exchanges] = await Promise.all([
    getPlatformStats(),
    getTopNeobanks(12),
    getTopExchanges(9),
  ]);

  const features = [
    [t("featChangeTitle"), t("featChangeBody")],
    [t("featSentimentTitle"), t("featSentimentBody")],
    [t("featMomentumTitle"), t("featMomentumBody")],
  ];

  return (
    <main>
      {/* Hero */}
      <section className="section">
        <div className="wrap" style={{ maxWidth: 880 }}>
          <p className="eyebrow" style={{ marginBottom: 18 }}>{t("eyebrow")}</p>
          <h1 className="display">
            {/* The highlighted word sits mid-sentence, and Polish puts it
                elsewhere — so the whole headline is one message with an <hl>
                tag rather than three concatenated fragments. */}
            {t.rich("headline", { hl: (c) => <Highlight>{c}</Highlight> })}
          </h1>
          <p className="lead" style={{ marginTop: 20, maxWidth: 620 }}>{t("lead")}</p>
          <div className="row" style={{ marginTop: 28 }}>
            <Link className="btn btn-cyan" href="/test/">{t("ctaReports")}</Link>
            <Link className="btn btn-ghost" href="/neobanks/">{t("ctaExplore")}</Link>
          </div>
          <div className="row" style={{ marginTop: 22, color: "var(--warm-gray)", fontSize: 13 }}>
            <span className="stars"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></span>
            {t("realReviews")}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="wrap">
        <div className="grid grid-4">
          <Stat num={String(stats.fintechs)} label={t("statFintechs")} />
          <Stat num={fmt(stats.ratings)} label={t("statRatings")} />
          <Stat num={String(stats.countries)} label={t("statCountries")} />
          <Stat num={t("statCadenceValue")} label={t("statCadence")} />
        </div>
      </section>

      {/* Top neobanks */}
      <section className="section">
        <div className="wrap">
          <div className="spread" style={{ marginBottom: 20 }}>
            <h2 className="h-sm">{t("topNeobanks")}</h2>
            <Link className="nav-link" href="/neobanks/" style={{ padding: 0, color: "var(--cyan-edge)" }}>
              {t("viewAll")}
            </Link>
          </div>
          <div className="grid grid-3">
            {neobanks.map((f) => (
              <FintechCard key={f.id} f={f} kind="neobank" />
            ))}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="wrap">
        <div className="grid grid-3">
          {features.map(([title, body]) => (
            <div key={title} className="feature-card">
              <h3 className="subheading" style={{ marginBottom: 8 }}>{title}</h3>
              <p className="muted" style={{ margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top exchanges */}
      <section className="section">
        <div className="wrap">
          <div className="spread" style={{ marginBottom: 20 }}>
            <h2 className="h-sm">{t("topExchanges")}</h2>
            <Link className="nav-link" href="/exchanges/" style={{ padding: 0, color: "var(--cyan-edge)" }}>
              {t("viewAll")}
            </Link>
          </div>
          <div className="grid grid-3">
            {exchanges.map((f) => (
              <FintechCard key={f.id} f={f} kind="exchange" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
