import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { BrandLogo } from "@/components/BrandLogo";
import { micaFaqs } from "@/lib/mica/reference";
import { getLocale, getTranslations } from "next-intl/server";
import { normalizeTags } from "@/lib/tags";
import { HIDE_COMPANY_FACTS, SUCCESSOR_LICENCE } from "@/lib/trust";
import { getSentimentIndex } from "@/lib/sentiment";
import { comparePeers, pairSlug } from "@/lib/compare";
import { SentimentIndexCard } from "@/components/SentimentIndex";
import {
  getFintech,
  getSeries,
  getProfileExtras,
  getPlatformRatings,
  getRatingDistribution,
  getPlatformSentimentSeries,
  getSocialPosts,
  getNews,
  getMentions,
  getMicaStatus,
  getAiSummary,
} from "@/lib/queries";
import {
  SeriesChart,
  PlatformSentimentChart,
  RatingDistribution,
  PlatformRatings,
  AiBrief,
  SocialFeed,
  NewsList,
  MentionsList,
  MicaLicence,
  FaqSection,
  flagEmoji,
  MiniStat,
  fmt,
  fmtMoney,
  fmtReplyTime,
} from "@/components/ui";

/**
 * Bare host from a stored website, for both the link target and its label.
 *
 * `fintechs.website` is stored without a scheme for all but a handful of rows,
 * and this used to interpolate it straight into `https://${website}` — so the
 * six rows that DID carry one (Revolut and N26 among them) rendered
 * `https://https://www.revolut.com`, a dead link on some of the most visited
 * profiles. Normalising here means a stray scheme in the data can no longer
 * produce a broken link, and the label reads consistently across the directory.
 */
function siteHost(website?: string | null): string | null {
  const host = (website ?? "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .trim();
  return host.includes(".") ? host : null;
}

/** Compact line-icon set for section headers (stroked, currentColor). */
const ICO: Record<string, string> = {
  glance: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v5l3 2",
  sentiment: "M3 12h4l3-8 4 16 3-8h4",
  ratings: "M12 2l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9z",
  app: "M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2",
  distribution: "M3 20h18M7 20V10M12 20V4M17 20v-7",
  trend: "M3 17l6-6 4 4 8-8M17 3h4v4",
  markets: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18",
  media: "M4 4h13v16H6a2 2 0 01-2-2zM17 8h3v10a2 2 0 01-2 2M8 8h5M8 12h5M8 16h3",
  social: "M21 11.5a8.4 8.4 0 01-9 8.4L3 21l1.1-6A8.4 8.4 0 1121 11.5z",
  mentions: "M7 8h10M7 12h6M5 4h14v12l-4 4v-4H7a2 2 0 01-2-2V6a2 2 0 012-2z",
  response: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  company: "M4 21V7l6-3 6 3v14M8 21V11M14 21V11M4 21h16",
  faq: "M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01M12 21a9 9 0 100-18 9 9 0 000 18z",
};
function Ico({ name }: { name: keyof typeof ICO }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICO[name]} />
    </svg>
  );
}
function SecHead({ icon, title, aux }: { icon: keyof typeof ICO; title: string; aux?: ReactNode }) {
  return (
    <div className="sec-head">
      <Ico name={icon} />
      <h2 className="subheading">{title}</h2>
      {aux != null && <span className="aux">{aux}</span>}
    </div>
  );
}
/** Sidebar "at a glance" fact row — renders only when the value is present. */
function SideFact({ k, v }: { k: string; v: ReactNode }) {
  if (v == null || v === "" || v === "—") return null;
  return (
    <div className="p-fact">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export default async function Profile({ slug }: { slug: string; kind?: "neobank" | "exchange" }) {
  const locale = await getLocale();
  const tp = await getTranslations("profile");
  const tt = await getTranslations("tags");
  const showBrief = locale === routing.defaultLocale;
  const ft = await getFintech(slug, locale);
  if (!ft) notFound();

  const [series, extras, platforms, distData, platformSent, social, news, mentions, brief] = await Promise.all([
    getSeries(slug),
    getProfileExtras(slug),
    getPlatformRatings(slug),
    getRatingDistribution(slug),
    getPlatformSentimentSeries(slug),
    getSocialPosts(slug, ft.name),
    getNews(slug, ft.name),
    getMentions(slug, ft.name),
    getAiSummary(slug, ft.name),
  ]);
  const mica = ft.type === "exchange" ? await getMicaStatus(slug) : null;
  const sentiment = await getSentimentIndex(slug);
  const kindType = ft.type === "exchange" ? "exchange" : "neobank";
  const peers = await comparePeers(slug, kindType);
  const tc = await getTranslations("compare");

  const DIST_SOURCE_LABEL: Record<string, string> = {
    trustpilot: "Trustpilot",
    google_play: "Google Play",
    app_store: "App Store",
  };

  // Cross-platform consensus (simple average of available platform ratings).
  const rated = platforms.filter((p) => p.rating != null);
  const avgRating = rated.length ? Math.round((rated.reduce((s, p) => s + (p.rating as number), 0) / rated.length) * 10) / 10 : null;
  const totalRatings = platforms.reduce((s, p) => s + (p.count ?? 0), 0);

  const tags: string[] = Array.isArray(ft.tags) ? ft.tags : [];
  const tagChips = normalizeTags(tags, ft.type === "exchange" ? "exchange" : "neobank");
  const regionName = (() => {
    try {
      // Country names in the reader's language — "Niemcy", not "Germany".
      const dn = new Intl.DisplayNames([locale], { type: "region" });
      return (cc: string) => dn.of(cc) ?? cc;
    } catch {
      return (cc: string) => cc;
    }
  })();
  // Curated FAQs are gated by the confidence audit (fact_confidence.faqs, aligned
  // to order) — an answer shows only when "high". The MiCA Q&A is generated from
  // the authoritative register, so it's always trusted.
  const faqConf: string[] = Array.isArray((ft.factConfidence as any)?.faqs) ? (ft.factConfidence as any).faqs : [];
  const faqs: { q: string; a: string }[] = (Array.isArray(ft.faqs) ? (ft.faqs as any[]) : []).filter((_, i) => faqConf[i] === "high");
  // Exchanges get auto-generated MiCA Q&A prepended to the curated FAQ.
  const allFaqs = mica ? [...micaFaqs(ft.name, mica, SUCCESSOR_LICENCE[ft.id]), ...faqs] : faqs;
  const licenses: string[] = Array.isArray(ft.licenses) ? (ft.licenses as any) : [];
  // Trust gate — only render a fact when the confidence audit marked it "high"
  // (see scripts/audit-confidence). Absent/"low" → we don't show it. Exchanges
  // never show the AI licence string; their regulator comes from the authoritative
  // MiCA register panel instead.
  const conf = (ft.factConfidence && typeof ft.factConfidence === "object" ? ft.factConfidence : {}) as Record<string, string>;
  const ok = (field: string) => conf[field] === "high";
  const availableIn: string[] = Array.isArray(ft.availableIn) ? (ft.availableIn as any) : [];
  const hasResponsiveness = extras?.responseRate != null || extras?.responseTime != null;
  const hasSeries = series.filter((p) => p.rating != null).length >= 2;

  // Per-platform sentiment trend — needs ≥2 distinct measurement days.
  const sentDates = new Set(platformSent.flatMap((s) => s.points.map((p) => p.date)));
  const hasSentTrend = sentDates.size >= 2;

  // ── Redesign helpers ───────────────────────────────────────────────────────
  const scoreColor = (v: number) => (v >= 80 ? "#16a34a" : v >= 60 ? "var(--cyan-edge)" : v >= 40 ? "#b45309" : "var(--neg)");
  const compositeScore = sentiment ? Math.round(sentiment.latest.composite) : null;
  // Company facts show only when the audit cleared them AND the brand isn't suppressed.
  const showFacts = !HIDE_COMPANY_FACTS.has(ft.id);
  const hasGlance =
    avgRating != null || compositeScore != null || totalRatings > 0 || !!mica || availableIn.length > 0 ||
    (showFacts &&
      ((ok("founded") && !!ft.founded) || (ok("headquarters") && !!ft.headquarters) || (ok("employees") && !!ft.employees) ||
        (ok("valuationUsd") && !!ft.valuationUsd) || (ok("status") && !!ft.status) || (ok("ownership") && !!ft.ownership) ||
        (ok("country") && !!ft.country)));
  // Screenshots: prefer App Store (higher-fidelity marketing shots), fall back
  // to Google Play. Label reflects whichever we're showing.
  const ssData = (ft.screenshots && typeof ft.screenshots === "object" ? ft.screenshots : {}) as { googlePlay?: string[]; appStore?: string[] };
  const screenshots: string[] =
    Array.isArray(ssData.appStore) && ssData.appStore.length ? ssData.appStore : Array.isArray(ssData.googlePlay) ? ssData.googlePlay : [];
  const screenshotsSource = Array.isArray(ssData.appStore) && ssData.appStore.length ? "App Store" : "Google Play";

  return (
    <main className="section" style={{ paddingTop: 12 }}>
      <div className="wrap">
        <p style={{ fontSize: 13, marginBottom: 12 }}>
          <Link href={ft.type === "exchange" ? "/exchanges/" : "/neobanks/"} style={{ color: "var(--cyan-edge)" }}>
            ← {ft.type === "exchange" ? tp("backExchanges") : tp("backNeobanks")}
          </Link>
        </p>

        {/* Header card — identity + at-a-glance score badge (top-right) */}
        <div className="card p-head" style={{ padding: "22px 24px", marginBottom: 20 }}>
          <BrandLogo src={ft.logoSvg} website={ft.website} name={ft.name} size={60} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <p className="eyebrow" style={{ marginBottom: 7 }}>
              {ft.type === "exchange" ? tp("kindExchange") : tp("kindNeobank")}
              {ok("country") && ft.country ? ` · ${flagEmoji(ft.country)} ${ft.country}` : ""}
            </p>
            <h1 className="h-sm" style={{ marginBottom: 0 }}>{ft.name}</h1>
            <p className="muted" style={{ margin: "8px 0 0" }}>
              {(ok("headquarters") && ft.headquarters) || (ok("country") && ft.country) || tp("global")}
              {siteHost(ft.website) && (
                <>
                  {" · "}
                  <a href={`https://${siteHost(ft.website)}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--cyan-edge)" }}>
                    {siteHost(ft.website)}
                  </a>
                </>
              )}
            </p>
            {tagChips.length > 0 && (
              <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {tagChips.map((c) => (
                  <Link key={c.slug} href={`/best/${c.slug}/`} className="badge" style={{ textDecoration: "none" }} title={tt(`${c.slug}.title`)}>
                    {tt(`${c.slug}.chip`)}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {compositeScore != null ? (
            <div className="p-badge">
              <span className="v" style={{ color: scoreColor(compositeScore) }}>{compositeScore}</span>
              <span className="l">{tp("sentimentLabel")} /100</span>
              {sentiment?.deltaWoW != null && sentiment.deltaWoW !== 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, marginTop: 5, color: sentiment.deltaWoW > 0 ? "#16a34a" : "var(--neg)" }}>
                  {sentiment.deltaWoW > 0 ? "▲" : "▼"} {Math.abs(sentiment.deltaWoW).toFixed(1)}
                </span>
              )}
            </div>
          ) : avgRating != null ? (
            <div className="p-badge">
              <span className="v">{avgRating.toFixed(1)}<span style={{ fontSize: 18, color: "var(--cyan-signal)" }}> ★</span></span>
              <span className="l">{tp("avgRating")}</span>
            </div>
          ) : null}
        </div>

        {ok("description") && ft.description && <p className="lead" style={{ marginTop: 0, marginBottom: 20, maxWidth: 760 }}>{ft.description}</p>}

        {/* MiCA / ESMA licence status — a headline trust signal for exchanges */}
        {mica && (
          <div style={{ marginBottom: 20 }}>
            <MicaLicence mica={mica} name={ft.name} successor={SUCCESSOR_LICENCE[ft.id]} />
          </div>
        )}

        {/* AI brief — English-only weekly digest (translating a weekly-regenerated
            digest would strand a stale paragraph next to fresh numbers). */}
        {brief.text && showBrief && (
          <div style={{ marginBottom: 20 }}>
            <AiBrief text={brief.text} isSample={brief.isSample} updatedAt={brief.updatedAt} />
          </div>
        )}

        {/* Two-column band: main signals (left) + at-a-glance summary (right sidebar) */}
        <div className="p-grid">
          <div className="p-col">
            {sentiment && <SentimentIndexCard data={sentiment} />}

            {platforms.length > 0 && (
              <div className="card">
                <SecHead
                  icon="ratings"
                  title={rated.length > 1 ? tp("ratingsAcross") : tp("rating")}
                  aux={rated.length > 1 && avgRating != null ? (
                    <><strong style={{ color: "var(--ink-black)", fontWeight: 600 }}>★ {avgRating.toFixed(1)}</strong> · {fmt(totalRatings)} · {rated.length}</>
                  ) : undefined}
                />
                <PlatformRatings items={platforms} />
              </div>
            )}
          </div>

          <aside className="p-side">
            {hasGlance && (
              <div className="card">
                <SecHead icon="glance" title={tp("atGlance")} />
                {avgRating != null && <SideFact k={tp("avgRating")} v={<span className="num">{avgRating.toFixed(1)} ★</span>} />}
                {compositeScore != null && <SideFact k={tp("sentimentLabel")} v={<span className="num" style={{ color: scoreColor(compositeScore) }}>{compositeScore}<span className="muted" style={{ fontWeight: 400 }}>/100</span></span>} />}
                {totalRatings > 0 && <SideFact k={tp("totalRatings")} v={<span className="num">{fmt(totalRatings)}</span>} />}
                {mica && <SideFact k={tp("micaLicence")} v={mica.licensed ? <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ {tp("yes")}</span> : <span className="muted">✕ {tp("no")}</span>} />}
                {showFacts && ok("country") && ft.country && <SideFact k={tp("countryLabel")} v={<><span aria-hidden>{flagEmoji(ft.country)}</span> {ft.country}</>} />}
                {showFacts && ok("founded") && ft.founded && <SideFact k={tp("founded")} v={<span className="num">{ft.founded}</span>} />}
                {showFacts && ok("headquarters") && ft.headquarters && <SideFact k={tp("headquarters")} v={ft.headquarters} />}
                {showFacts && ok("employees") && ft.employees && <SideFact k={tp("employees")} v={<span className="num">{fmt(ft.employees)}</span>} />}
                {showFacts && ok("valuationUsd") && ft.valuationUsd && <SideFact k={tp("valuation")} v={<span className="num">{fmtMoney(ft.valuationUsd)}</span>} />}
                {showFacts && ok("status") && ft.status && <SideFact k={tp("status")} v={ft.status} />}
                {showFacts && ok("ownership") && ft.ownership && <SideFact k={tp("ownership")} v={ft.ownership} />}
                {showFacts && ft.type !== "exchange" && ok("licenses") && licenses.length > 0 && <SideFact k={tp("licenses")} v={licenses.slice(0, 3).join(", ")} />}
                {availableIn.length > 0 && <SideFact k={tp("availableIn")} v={tp("markets", { count: availableIn.length })} />}
              </div>
            )}

            {hasResponsiveness && (
              <div className="card">
                <SecHead icon="response" title={tp("responsiveness")} />
                <div className="row" style={{ gap: 28 }}>
                  {extras?.responseRate != null && <MiniStat label={tp("repliesToReviews")} value={`${Math.round(extras.responseRate)}%`} />}
                  {extras?.responseTime != null && <MiniStat label={tp("typicalReplyTime")} value={fmtReplyTime(extras.responseTime)} />}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Where the brand operates — markets with flags */}
        {availableIn.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <SecHead icon="markets" title={tp("operatesIn", { name: ft.name })} aux={`${availableIn.length} markets`} />
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {availableIn.map((cc) => (
                <span key={cc} className="badge" style={{ fontSize: 12 }}>
                  <span aria-hidden>{flagEmoji(cc)}</span> {regionName(cc)}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Rating distribution (best available source) */}
        {distData && (
          <div className="card" style={{ marginTop: 24 }}>
            <SecHead
              icon="distribution"
              title={tp("ratingDistribution")}
              aux={distData.sources.length === 3 ? "All platforms" : distData.sources.map((s) => DIST_SOURCE_LABEL[s] ?? s).join(" · ")}
            />
            <RatingDistribution dist={distData.dist} />
          </div>
        )}

        {/* Review volume over time (live Trustpilot series) */}
        {hasSeries && (
          <div className="card" style={{ marginTop: 20 }}>
            <SecHead icon="trend" title={tp("ratingOverTime")} />
            <SeriesChart points={series.map((p) => ({ date: p.date, rating: p.rating, count: p.count }))} />
          </div>
        )}

        {/* Brand sentiment trend — positive sentiment per platform over time */}
        {hasSentTrend && (
          <div className="card" style={{ marginTop: 20 }}>
            <SecHead icon="trend" title={tp("sentimentTrend")} aux="positive sentiment, by platform" />
            <PlatformSentimentChart series={platformSent} />
          </div>
        )}

        {/* App screenshots — full-width scroll strip (App Store, else Google Play) */}
        {screenshots.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <SecHead icon="app" title={tp("screenshots")} aux={screenshotsSource} />
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "thin" }}>
              {screenshots.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt={tp("screenshotAlt", { name: ft.name, n: i + 1 })}
                  loading="lazy"
                  style={{ height: 300, width: "auto", flex: "none", borderRadius: 12, border: "1px solid var(--stone-border)", background: "var(--stone-canvas)" }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Public content signals — news / social / mentions, sample-first until live */}
        {(news.items.length > 0 || social.posts.length > 0 || mentions.items.length > 0) && (
          <div className="grid grid-2" style={{ marginTop: 20, alignItems: "start" }}>
            {news.items.length > 0 && (
              <div className="card">
                <SecHead icon="media" title={tp("inTheMedia")} aux={news.isSample ? <span className="pill pill-neutral" title={tp("samplePreview")}>{tp("sample")}</span> : "brand coverage"} />
                <NewsList items={news.items} />
              </div>
            )}

            {social.posts.length > 0 && (
              <div className="card">
                <SecHead icon="social" title={tp("latestSocial")} aux={social.isSample ? <span className="pill pill-neutral" title={tp("samplePreview")}>{tp("sample")}</span> : "LinkedIn & Facebook"} />
                <SocialFeed posts={social.posts} name={ft.name} logo={ft.logoSvg} website={ft.website} />
              </div>
            )}

            {mentions.items.length > 0 && (
              <div className="card">
                <SecHead icon="mentions" title={tp("whatPeopleSay")} aux={mentions.isSample ? <span className="pill pill-neutral" title={tp("samplePreview")}>{tp("sample")}</span> : "mentions on X, Reddit & Facebook"} />
                <MentionsList items={mentions.items} />
              </div>
            )}
          </div>
        )}

        {/* About — same-origin AI prose, gated on the description's confidence. */}
        {ok("description") && ft.about && (
          <div style={{ marginTop: 40, maxWidth: 760 }}>
            <h2 className="subheading" style={{ marginBottom: 12 }}>{tp("about", { name: ft.name })}</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.8 }}>{ft.about}</p>
          </div>
        )}

        {/* FAQ — accordion + FAQPage structured data (MiCA Q&A for exchanges) */}
        <FaqSection items={allFaqs} />

        {/* Compare with similar — head-to-head suggestions (SEO comparison pages) */}
        {peers.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h2 className="subheading" style={{ marginBottom: 14 }}>
              {tc("similarHeading", { name: ft.name, type: kindType === "exchange" ? tc("typeExchange") : tc("typeNeobank") })}
            </h2>
            <div className="grid grid-4">
              {peers.map((peer) => (
                <Link
                  key={peer.id}
                  href={`/compare/${pairSlug(slug, peer.id)}/`}
                  className="card card-tight"
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                    <BrandLogo src={ft.logoSvg} website={ft.website} name={ft.name} size={26} />
                    <span className="muted" style={{ fontSize: 12 }}>{tc("vs")}</span>
                    <BrandLogo src={peer.logoSvg} website={peer.website} name={peer.name} size={26} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{ft.name} {tc("vs")} {peer.name}</div>
                  <div style={{ color: "var(--cyan-edge)", fontSize: 13, marginTop: 4 }}>{tc("compareCta")}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="muted" style={{ marginTop: 40, fontSize: 12 }}>
          Ratings &amp; sentiment aggregated from Trustpilot, Google Play and App Store — anonymised store
          metrics only, no individual reviews.
        </p>
      </div>
    </main>
  );
}
