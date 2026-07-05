import { notFound } from "next/navigation";
import { getFintech, getSeries, getRecentReviews, getCountryBreakdown } from "@/lib/queries";
import { Stars, TrustScore, SeriesChart, SentimentMeter, flagEmoji, fmt } from "@/components/ui";

function timeAgo(d: Date | null): string {
  if (!d) return "";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default async function Profile({ slug }: { slug: string; kind?: "neobank" | "exchange" }) {
  const ft = await getFintech(slug);
  if (!ft) notFound();

  const [series, reviews, countries] = await Promise.all([
    getSeries(slug),
    getRecentReviews(slug, 8),
    getCountryBreakdown(slug),
  ]);

  const latest = series[series.length - 1];
  const prev = series[series.length - 2];
  const growth = latest?.count != null && prev?.count != null ? latest.count - prev.count : null;
  const tags: string[] = Array.isArray(ft.tags) ? ft.tags : [];
  const faqs: { q: string; a: string }[] = Array.isArray(ft.faqs) ? (ft.faqs as any) : [];

  return (
    <main className="section">
      <div className="wrap">
        {/* Breadcrumb */}
        <p style={{ fontSize: 13, marginBottom: 20 }}>
          <a href={ft.type === "exchange" ? "/exchanges/" : "/neobanks/"} style={{ color: "var(--cyan-edge)" }}>
            ← {ft.type === "exchange" ? "Exchanges" : "Neobanks"}
          </a>
        </p>

        {/* Header */}
        <div className="row" style={{ gap: 18, alignItems: "flex-start" }}>
          {ft.logoSvg && <img className="flogo" style={{ width: 64, height: 64 }} src={ft.logoSvg} alt={`${ft.name} logo`} />}
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="row" style={{ gap: 12 }}>
              <h1 className="h-sm" style={{ marginBottom: 0 }}>{ft.name}</h1>
              <TrustScore rating={latest?.rating ?? null} />
            </div>
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

        {/* Stat tiles */}
        <div className="grid grid-4" style={{ marginTop: 28 }}>
          <div className="stat">
            <div className="num">{latest?.rating != null ? latest.rating.toFixed(1) : "—"}</div>
            <div className="lbl">Current TrustScore</div>
          </div>
          <div className="stat">
            <div className="num">{fmt(latest?.count ?? null)}</div>
            <div className="lbl">Total reviews</div>
          </div>
          <div className="stat">
            <div className="num">{latest?.pos != null ? `${latest.pos.toFixed(0)}%` : "—"}</div>
            <div className="lbl">Positive sentiment</div>
          </div>
          <div className="stat">
            <div className="num">{growth != null ? (growth >= 0 ? `+${fmt(growth)}` : fmt(growth)) : "—"}</div>
            <div className="lbl">New reviews (latest)</div>
          </div>
        </div>

        {/* Chart */}
        <div className="card" style={{ marginTop: 28 }}>
          <h2 className="subheading" style={{ marginBottom: 16 }}>Trustpilot history</h2>
          <SeriesChart points={series.map((p) => ({ date: p.date, rating: p.rating, count: p.count }))} />
        </div>

        {/* Two columns */}
        <div className="grid grid-2" style={{ marginTop: 28, alignItems: "start" }}>
          {/* Reviews */}
          <div>
            <h2 className="subheading" style={{ marginBottom: 16 }}>Recent reviews</h2>
            <div className="stack-16">
              {reviews.length === 0 && <p className="muted">No individual reviews collected yet.</p>}
              {reviews.map((r, i) => (
                <div key={i} className="review">
                  <div className="spread">
                    <Stars rating={r.rating} />
                    <span style={{ fontSize: 12, color: "var(--ash-gray)" }}>
                      {flagEmoji(r.country)} {r.country}
                    </span>
                  </div>
                  {r.title && <p style={{ fontWeight: 500, color: "var(--ink-black)" }}>{r.title}</p>}
                  {r.body && <p>{r.body.length > 260 ? r.body.slice(0, 260) + "…" : r.body}</p>}
                  <div className="meta">{timeAgo(r.postedAt as Date | null)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="stack-24">
            {latest?.pos != null && (
              <div className="card card-tight">
                <SentimentMeter pos={latest.pos} />
              </div>
            )}
            {countries.length > 0 && (
              <div className="card card-tight">
                <h3 className="subheading" style={{ fontSize: 15, marginBottom: 12 }}>By reviewer country</h3>
                <div className="stack-8">
                  {countries.slice(0, 10).map((c) => (
                    <div key={c.country} className="spread" style={{ fontSize: 13 }}>
                      <span>{flagEmoji(c.country)} {c.country}</span>
                      <span className="muted">
                        {c.rating != null && `★${c.rating.toFixed(1)} · `}
                        {fmt(c.count)} rev
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ft.about && (
              <div className="card card-tight">
                <h3 className="subheading" style={{ fontSize: 15, marginBottom: 8 }}>About</h3>
                <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{ft.about}</p>
              </div>
            )}
          </div>
        </div>

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
      </div>
    </main>
  );
}
