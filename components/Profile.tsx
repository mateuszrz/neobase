import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getFintech, getSeries, getProfileExtras, getPlatformRatings, getRatingDistribution } from "@/lib/queries";
import {
  SeriesChart,
  RatingDistribution,
  PlatformRatings,
  MiniStat,
  flagEmoji,
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

  const [series, extras, platforms, distData] = await Promise.all([
    getSeries(slug),
    getProfileExtras(slug),
    getPlatformRatings(slug),
    getRatingDistribution(slug),
  ]);

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
  const faqs: { q: string; a: string }[] = Array.isArray(ft.faqs) ? (ft.faqs as any) : [];
  const licenses: string[] = Array.isArray(ft.licenses) ? (ft.licenses as any) : [];
  const availableIn: string[] = Array.isArray(ft.availableIn) ? (ft.availableIn as any) : [];
  const hasResponsiveness = extras?.responseRate != null || extras?.responseTime != null;
  const hasSeries = series.filter((p) => p.rating != null).length >= 2;

  return (
    <main className="section">
      <div className="wrap">
        <p style={{ fontSize: 13, marginBottom: 20 }}>
          <a href={ft.type === "exchange" ? "/exchanges/" : "/neobanks/"} style={{ color: "var(--cyan-edge)" }}>
            ← {ft.type === "exchange" ? "Exchanges" : "Neobanks"}
          </a>
        </p>

        {/* Header — identity only; ratings live in the hero below */}
        <div className="row" style={{ gap: 18, alignItems: "flex-start" }}>
          {ft.logoSvg && <img className="flogo" style={{ width: 64, height: 64 }} src={ft.logoSvg} alt={`${ft.name} logo`} />}
          <div style={{ flex: 1, minWidth: 240 }}>
            <p className="eyebrow" style={{ marginBottom: 7 }}>
              {ft.type === "exchange" ? "Crypto exchange" : "Neobank"}
              {ft.country ? ` · ${ft.country}` : ""}
            </p>
            <h1 className="h-sm" style={{ marginBottom: 0 }}>{ft.name}</h1>
            <p className="muted" style={{ margin: "8px 0 0" }}>
              {flagEmoji(ft.country)} {ft.headquarters || ft.country || "Global"}
              {ft.website && (
                <>
                  {" · "}
                  <a href={`https://${ft.website}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--cyan-edge)" }}>
                    {ft.website}
                  </a>
                </>
              )}
            </p>
            {tags.length > 0 && (
              <div className="row" style={{ gap: 6, marginTop: 12 }}>
                {tags.slice(0, 8).map((t) => (
                  <span key={t} className="badge">{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {ft.description && <p className="lead" style={{ marginTop: 20, maxWidth: 760 }}>{ft.description}</p>}

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
                  <span className="muted" style={{ fontSize: 12 }}>{DIST_SOURCE_LABEL[distData.source] ?? distData.source}</span>
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

        {/* Review volume over time (Trustpilot history) */}
        {hasSeries && (
          <div className="card" style={{ marginTop: 20 }}>
            <h2 className="subheading" style={{ marginBottom: 16 }}>Rating &amp; review volume over time</h2>
            <SeriesChart points={series.map((p) => ({ date: p.date, rating: p.rating, count: p.count, live: p.live }))} />
          </div>
        )}

        {/* Company facts */}
        <div className="card" style={{ marginTop: 20 }}>
          <h2 className="subheading" style={{ marginBottom: 14 }}>Company</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", columnGap: 40 }}>
            <FactRow label="Founded" value={ft.founded ?? undefined} />
            <FactRow label="Headquarters" value={ft.headquarters ?? undefined} />
            <FactRow label="Employees" value={ft.employees ? fmt(ft.employees) : undefined} />
            <FactRow label="Valuation" value={ft.valuationUsd ? fmtMoney(ft.valuationUsd) : undefined} />
            <FactRow label="Status" value={ft.status ?? undefined} />
            <FactRow label="Licenses" value={licenses.length ? licenses.slice(0, 4).join(", ") : undefined} />
            <FactRow label="Available in" value={availableIn.length ? `${availableIn.length} markets` : undefined} />
          </div>
        </div>

        {/* About */}
        {ft.about && (
          <div style={{ marginTop: 40, maxWidth: 760 }}>
            <h2 className="subheading" style={{ marginBottom: 12 }}>About {ft.name}</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.8 }}>{ft.about}</p>
          </div>
        )}

        {/* FAQs */}
        {faqs.length > 0 && (
          <div style={{ marginTop: 40, maxWidth: 760 }}>
            <h2 className="subheading" style={{ marginBottom: 16 }}>FAQ</h2>
            <div className="stack-16">
              {faqs.slice(0, 6).map((f, i) => (
                <div key={i}>
                  <p style={{ fontWeight: 500, margin: "0 0 4px" }}>{f.q}</p>
                  <p className="muted" style={{ margin: 0 }}>{f.a}</p>
                </div>
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
