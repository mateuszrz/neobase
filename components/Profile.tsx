import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { micaFaqs } from "@/lib/mica/reference";
import { normalizeTags } from "@/lib/tags";
import { HIDE_COMPANY_FACTS } from "@/lib/trust";
import { getSentimentIndex } from "@/lib/sentiment";
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

function FactRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="spread" style={{ fontSize: 13, padding: "7px 0", borderBottom: "1px solid var(--stone-border)" }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default async function Profile({ slug }: { slug: string; kind?: "neobank" | "exchange" }) {
  const ft = await getFintech(slug);
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
      const dn = new Intl.DisplayNames(["en"], { type: "region" });
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
  const allFaqs = mica ? [...micaFaqs(ft.name, mica), ...faqs] : faqs;
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

  return (
    <main className="section" style={{ paddingTop: 12 }}>
      <div className="wrap">
        <p style={{ fontSize: 13, marginBottom: 12 }}>
          <a href={ft.type === "exchange" ? "/exchanges/" : "/neobanks/"} style={{ color: "var(--cyan-edge)" }}>
            ← {ft.type === "exchange" ? "Exchanges" : "Neobanks"}
          </a>
        </p>

        {/* Header — identity only; ratings live in the hero below */}
        <div className="row" style={{ gap: 18, alignItems: "flex-start" }}>
          <BrandLogo src={ft.logoSvg} website={ft.website} name={ft.name} size={64} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <p className="eyebrow" style={{ marginBottom: 7 }}>
              {ft.type === "exchange" ? "Crypto exchange" : "Neobank"}
              {ok("country") && ft.country ? ` · ${ft.country}` : ""}
            </p>
            <h1 className="h-sm" style={{ marginBottom: 0 }}>{ft.name}</h1>
            <p className="muted" style={{ margin: "8px 0 0" }}>
              {(ok("headquarters") && ft.headquarters) || (ok("country") && ft.country) || "Global"}
              {ft.website && (
                <>
                  {" · "}
                  <a href={`https://${ft.website}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--cyan-edge)" }}>
                    {ft.website}
                  </a>
                </>
              )}
            </p>
            {tagChips.length > 0 && (
              <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {tagChips.map((c) => (
                  <a key={c.slug} href={`/best/${c.slug}/`} className="badge" style={{ textDecoration: "none" }} title={`Best ${c.chip.toLowerCase()} →`}>
                    {c.chip}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {ok("description") && ft.description && <p className="lead" style={{ marginTop: 20, maxWidth: 760 }}>{ft.description}</p>}

        {/* MiCA / ESMA licence status — a headline trust signal for exchanges */}
        {mica && (
          <div style={{ marginTop: 24 }}>
            <MicaLicence mica={mica} name={ft.name} />
          </div>
        )}

        {/* Sentiment overview (AI narrative) + composite sentiment index, side by side */}
        {(brief.text || sentiment) && (
          <div className="grid grid-2" style={{ marginTop: 24, alignItems: "stretch" }}>
            {brief.text && <AiBrief text={brief.text} isSample={brief.isSample} updatedAt={brief.updatedAt} />}
            {sentiment && <SentimentIndexCard data={sentiment} />}
          </div>
        )}

        {/* Where the brand operates — markets with flags */}
        {availableIn.length > 0 && (
          <section style={{ marginTop: 28 }}>
            <div className="spread" style={{ marginBottom: 12, alignItems: "baseline" }}>
              <h2 className="subheading">Where {ft.name} operates</h2>
              <span className="muted" style={{ fontSize: 12 }}>{availableIn.length} markets</span>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {availableIn.map((cc) => (
                <span key={cc} className="badge" style={{ fontSize: 12 }}>
                  <span aria-hidden>{flagEmoji(cc)}</span> {regionName(cc)}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* HERO — cross-platform ratings, the differentiator */}
        {platforms.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <div className="spread" style={{ marginBottom: 16, alignItems: "flex-end" }}>
              <h2 className="subheading">{rated.length > 1 ? "Ratings across platforms" : "Rating"}</h2>
              {rated.length > 1 && avgRating != null && (
                <span style={{ fontSize: 13 }}>
                  <strong style={{ color: "var(--ink-black)", fontWeight: 600 }}>★ {avgRating.toFixed(1)}</strong>
                  <span className="muted"> avg · {fmt(totalRatings)} ratings · {rated.length} platforms</span>
                </span>
              )}
            </div>
            <PlatformRatings items={platforms} />
          </section>
        )}

        {/* Rating distribution (best available source) + Trustpilot responsiveness */}
        {(distData || hasResponsiveness) && (
          <div className="grid grid-2" style={{ marginTop: 20, alignItems: "start" }}>
            {distData && (
              <div className="card">
                <div className="spread" style={{ marginBottom: 14 }}>
                  <h2 className="subheading">Rating distribution</h2>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {distData.sources.length === 3
                      ? "All platforms"
                      : distData.sources.map((s) => DIST_SOURCE_LABEL[s] ?? s).join(" · ")}
                  </span>
                </div>
                <RatingDistribution dist={distData.dist} />
              </div>
            )}
            {hasResponsiveness && (
              <div className="card">
                <h2 className="subheading" style={{ marginBottom: 16 }}>Company responsiveness</h2>
                <div className="row" style={{ gap: 40 }}>
                  {extras?.responseRate != null && <MiniStat label="Replies to reviews" value={`${Math.round(extras.responseRate)}%`} />}
                  {extras?.responseTime != null && <MiniStat label="Typical reply time" value={fmtReplyTime(extras.responseTime)} />}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Review volume over time (live Trustpilot series) */}
        {hasSeries && (
          <div className="card" style={{ marginTop: 20 }}>
            <h2 className="subheading" style={{ marginBottom: 16 }}>Rating &amp; review volume over time</h2>
            <SeriesChart points={series.map((p) => ({ date: p.date, rating: p.rating, count: p.count }))} />
          </div>
        )}

        {/* Brand sentiment trend — positive sentiment per platform over time */}
        {hasSentTrend && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="spread" style={{ marginBottom: 16, alignItems: "flex-end" }}>
              <h2 className="subheading">Brand sentiment trend</h2>
              <span className="muted" style={{ fontSize: 12 }}>positive sentiment, by platform</span>
            </div>
            <PlatformSentimentChart series={platformSent} />
          </div>
        )}

        {/* Public content signals — news / social / blog, two-up on wide screens.
            Each is sample-first until the live source is enabled. */}
        {(news.items.length > 0 || social.posts.length > 0 || mentions.items.length > 0) && (
          <div className="grid grid-2" style={{ marginTop: 20, alignItems: "start" }}>
            {news.items.length > 0 && (
              <div className="card">
                <div className="spread" style={{ marginBottom: 16, alignItems: "baseline" }}>
                  <h2 className="subheading">In the media</h2>
                  {news.isSample ? (
                    <span className="pill pill-neutral" title="Preview data — live news feed coming soon">Sample</span>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>brand coverage</span>
                  )}
                </div>
                <NewsList items={news.items} />
              </div>
            )}

            {social.posts.length > 0 && (
              <div className="card">
                <div className="spread" style={{ marginBottom: 16, alignItems: "baseline" }}>
                  <h2 className="subheading">Latest from social</h2>
                  {social.isSample ? (
                    <span className="pill pill-neutral" title="Preview data — live social feed coming soon">Sample</span>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>LinkedIn &amp; Facebook</span>
                  )}
                </div>
                <SocialFeed posts={social.posts} name={ft.name} logo={ft.logoSvg} website={ft.website} />
              </div>
            )}

            {mentions.items.length > 0 && (
              <div className="card">
                <div className="spread" style={{ marginBottom: 16, alignItems: "baseline" }}>
                  <h2 className="subheading">What people are saying</h2>
                  {mentions.isSample ? (
                    <span className="pill pill-neutral" title="Preview data — live mentions feed coming soon">Sample</span>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>mentions on X, Reddit &amp; Facebook</span>
                  )}
                </div>
                <MentionsList items={mentions.items} />
              </div>
            )}
          </div>
        )}

        {/* Company facts — only the fields the confidence audit cleared as "high",
            and only where the block as a whole isn't suppressed (see lib/trust). */}
        {!HIDE_COMPANY_FACTS.has(ft.id) && (
          (ok("founded") && ft.founded) || (ok("headquarters") && ft.headquarters) ||
          (ok("employees") && ft.employees) || (ok("valuationUsd") && ft.valuationUsd) ||
          (ok("status") && ft.status) || (ft.type !== "exchange" && ok("licenses") && licenses.length) ||
          availableIn.length
        ) ? (
        <div className="card" style={{ marginTop: 20 }}>
          <h2 className="subheading" style={{ marginBottom: 14 }}>Company</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", columnGap: 40 }}>
            <FactRow label="Founded" value={ok("founded") ? (ft.founded ?? undefined) : undefined} />
            <FactRow label="Headquarters" value={ok("headquarters") ? (ft.headquarters ?? undefined) : undefined} />
            <FactRow label="Employees" value={ok("employees") && ft.employees ? fmt(ft.employees) : undefined} />
            <FactRow label="Valuation" value={ok("valuationUsd") && ft.valuationUsd ? fmtMoney(ft.valuationUsd) : undefined} />
            <FactRow label="Status" value={ok("status") ? (ft.status ?? undefined) : undefined} />
            {/* Exchanges: regulator comes from the authoritative MiCA panel above, not this AI field. */}
            <FactRow label="Licenses" value={ft.type !== "exchange" && ok("licenses") && licenses.length ? licenses.slice(0, 4).join(", ") : undefined} />
            <FactRow label="Available in" value={availableIn.length ? `${availableIn.length} markets` : undefined} />
          </div>
        </div>
        ) : null}

        {/* About — same-origin AI prose, gated on the description's confidence. */}
        {ok("description") && ft.about && (
          <div style={{ marginTop: 40, maxWidth: 760 }}>
            <h2 className="subheading" style={{ marginBottom: 12 }}>About {ft.name}</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.8 }}>{ft.about}</p>
          </div>
        )}

        {/* FAQ — accordion + FAQPage structured data (MiCA Q&A for exchanges) */}
        <FaqSection items={allFaqs} />

        <p className="muted" style={{ marginTop: 40, fontSize: 12 }}>
          Ratings &amp; sentiment aggregated from Trustpilot, Google Play and App Store — anonymised store
          metrics only, no individual reviews.
        </p>
      </div>
    </main>
  );
}
