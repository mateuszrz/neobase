import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getFintech, getSeries, getCountryBreakdown } from "@/lib/queries";
import {
  TrustScore,
  SeriesChart,
  SentimentChart,
  SentimentMeter,
  Delta,
  flagEmoji,
  fmt,
  fmtMoney,
} from "@/components/ui";

function FactRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="spread" style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--stone-border)" }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default async function Profile({ slug }: { slug: string; kind?: "neobank" | "exchange" }) {
  const ft = await getFintech(slug);
  if (!ft) notFound();

  const [series, countries] = await Promise.all([getSeries(slug), getCountryBreakdown(slug)]);

  const latest = series[series.length - 1];
  const prev = series[series.length - 2];
  const ratingDelta = latest?.rating != null && prev?.rating != null ? Math.round((latest.rating - prev.rating) * 100) / 100 : null;
  const reviewDelta = latest?.count != null && prev?.count != null ? latest.count - prev.count : null;
  const sentDelta = latest?.pos != null && prev?.pos != null ? Math.round((latest.pos - prev.pos) * 10) / 10 : null;
  const since = prev?.date?.slice(0, 7) ?? undefined;

  const tags: string[] = Array.isArray(ft.tags) ? ft.tags : [];
  const faqs: { q: string; a: string }[] = Array.isArray(ft.faqs) ? (ft.faqs as any) : [];
  const licenses: string[] = Array.isArray(ft.licenses) ? (ft.licenses as any) : [];
  const availableIn: string[] = Array.isArray(ft.availableIn) ? (ft.availableIn as any) : [];

  return (
    <main className="section">
      <div className="wrap">
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

        {/* Momentum tiles — current value + change over time */}
        <div className="grid grid-4" style={{ marginTop: 28 }}>
          <div className="stat">
            <div className="num">{latest?.rating != null ? latest.rating.toFixed(1) : "—"}</div>
            <div className="lbl">TrustScore</div>
            <div style={{ marginTop: 6 }}><Delta value={ratingDelta} since={since} /></div>
          </div>
          <div className="stat">
            <div className="num">{fmt(latest?.count ?? null)}</div>
            <div className="lbl">Total reviews</div>
            <div style={{ marginTop: 6 }}><Delta value={reviewDelta} since={since} /></div>
          </div>
          <div className="stat">
            <div className="num">{latest?.pos != null ? `${latest.pos.toFixed(0)}%` : "—"}</div>
            <div className="lbl">Positive sentiment</div>
            <div style={{ marginTop: 6 }}><Delta value={sentDelta} suffix="pp" since={since} /></div>
          </div>
          <div className="stat">
            <div className="num">{countries.length || "—"}</div>
            <div className="lbl">Reviewer countries</div>
          </div>
        </div>

        {/* Charts */}
        <div className="card" style={{ marginTop: 28 }}>
          <h2 className="subheading" style={{ marginBottom: 16 }}>Rating &amp; review volume over time</h2>
          <SeriesChart points={series.map((p) => ({ date: p.date, rating: p.rating, count: p.count }))} />
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h2 className="subheading" style={{ marginBottom: 16 }}>Sentiment over time</h2>
          <SentimentChart points={series.map((p) => ({ date: p.date, pos: p.pos }))} />
        </div>

        {/* Two columns: facts + country sentiment */}
        <div className="grid grid-2" style={{ marginTop: 28, alignItems: "start" }}>
          <div className="card">
            <h2 className="subheading" style={{ marginBottom: 12 }}>Company</h2>
            <FactRow label="Founded" value={ft.founded ?? undefined} />
            <FactRow label="Headquarters" value={ft.headquarters ?? undefined} />
            <FactRow label="Employees" value={ft.employees ? fmt(ft.employees) : undefined} />
            <FactRow label="Valuation" value={ft.valuationUsd ? fmtMoney(ft.valuationUsd) : undefined} />
            <FactRow label="Status" value={ft.status ?? undefined} />
            <FactRow label="Licenses" value={licenses.length ? licenses.slice(0, 4).join(", ") : undefined} />
            <FactRow label="Available in" value={availableIn.length ? `${availableIn.length} markets` : undefined} />
          </div>

          <div className="card">
            <div className="spread" style={{ marginBottom: 12 }}>
              <h2 className="subheading">Sentiment by country</h2>
              <span className="muted" style={{ fontSize: 12 }}>reviewer origin</span>
            </div>
            {countries.length === 0 && <p className="muted">Country segmentation accrues as reviews are collected.</p>}
            <div className="stack-16">
              {countries.slice(0, 10).map((c) => (
                <div key={c.country}>
                  <div className="spread" style={{ fontSize: 13, marginBottom: 4 }}>
                    <span>{flagEmoji(c.country)} {c.country} <span className="muted">· {fmt(c.count)} rev</span></span>
                    <span style={{ fontWeight: 500 }}>{c.pos != null ? `${c.pos.toFixed(0)}%` : c.rating != null ? `★${c.rating.toFixed(1)}` : "—"}</span>
                  </div>
                  {c.pos != null && (
                    <div className="meter"><span style={{ width: `${Math.max(0, Math.min(100, c.pos))}%` }} /></div>
                  )}
                </div>
              ))}
            </div>
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
          Ratings &amp; sentiment aggregated from Trustpilot. Google Play &amp; App Store tracking coming next.
        </p>
      </div>
    </main>
  );
}
