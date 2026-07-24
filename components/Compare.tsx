import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { flagEmoji, fmt } from "@/components/ui";
import { env } from "@/lib/env";
import type { Comparison, CompareSide, CompareMetric, Winner } from "@/lib/compare";

function scoreColor(v: number): string {
  if (v >= 80) return "#16a34a";
  if (v >= 60) return "var(--cyan-edge)";
  if (v >= 40) return "#b45309";
  return "var(--neg)";
}

const GREEN = "#16a34a";
const WIN_BG = "rgba(22,163,74,0.06)";

/** One platform's rating strip inside the comparison table (rating + count). */
function ratingCell(side: CompareSide, key: string) {
  const r = (side.ratings as any)[key] as { rating: number | null; count: number | null };
  if (r?.rating == null) return null;
  return r;
}

export default async function Compare({ cmp, pair }: { cmp: Comparison; pair: string }) {
  const t = await getTranslations("compare");
  const { a, b, type, metrics, winnerBoxes, aWins, bWins } = cmp;
  const kindA = type === "exchange" ? "exchange" : "fintech";
  const typeWord = type === "exchange" ? t("typeExchange") : t("typeNeobank");
  const base = env.APP_BASE_URL.replace(/\/$/, "");

  // Group metrics by section, in display order, dropping empty sections.
  const order: CompareMetric["section"][] = ["sentiment", "ratings", "company", "mica"];
  const sections = order
    .map((s) => ({ s, rows: metrics.filter((m) => m.section === s && !(m.a == null && m.b == null)) }))
    .filter((g) => g.rows.length);

  // ── Value formatting per metric kind ──────────────────────────────────────
  function display(m: CompareMetric, which: "a" | "b"): React.ReactNode {
    const v = which === "a" ? m.a : m.b;
    const side = which === "a" ? a : b;
    if (v == null || v === "") return <span className="muted">-</span>;
    switch (m.kind) {
      case "score":
        return <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, color: scoreColor(Number(v)) }}>{Number(v).toFixed(0)}</span>;
      case "rating": {
        const r = ratingCell(side, m.key);
        return (
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20 }}>
              {Number(v).toFixed(1)} <span style={{ fontSize: 13, color: "var(--cyan-signal)" }}>★</span>
            </div>
            {r?.count != null && <div className="muted" style={{ fontSize: 11 }}>{t("ratingsUnit", { count: r.count })}</div>}
          </div>
        );
      }
      case "count":
        return <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18 }}>{fmt(Number(v))}</span>;
      case "year":
        return <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18 }}>{Number(v)}</span>;
      case "bool":
        return v ? <span style={{ color: GREEN, fontWeight: 600 }}>✓ {t("yes")}</span> : <span className="muted">✕ {t("no")}</span>;
      case "services":
        return <span style={{ fontWeight: 600 }}>{t("servicesUnit", { count: Number(v) })}</span>;
      case "text":
      default:
        if (m.key === "country") return <span>{flagEmoji(String(v))} {String(v)}</span>;
        return <span>{String(v)}</span>;
    }
  }

  function cellStyle(win: Winner, which: "a" | "b"): React.CSSProperties {
    const isWin = win === which;
    return {
      padding: "12px 16px",
      textAlign: "center",
      background: isWin ? WIN_BG : undefined,
      borderLeft: which === "b" ? "1px solid var(--stone-border)" : undefined,
    };
  }

  // ── Prose summary (assembled from translated templates) ───────────────────
  const paras: string[] = [];
  paras.push(t("prose.intro", { a: a.name, b: b.name, type: typeWord }));
  const sMetric = metrics.find((m) => m.key === "sentiment");
  if (sMetric && (sMetric.a != null || sMetric.b != null)) {
    if (sMetric.win === "tie") paras.push(t("prose.sentimentTie", { score: Math.round(Number(sMetric.a ?? sMetric.b)) }));
    else if (sMetric.win) {
      const w = sMetric.win === "a" ? a : b;
      const l = sMetric.win === "a" ? b : a;
      paras.push(t("prose.sentimentLead", { winner: w.name, loser: l.name, wScore: Math.round(Number(sMetric.win === "a" ? sMetric.a : sMetric.b)), lScore: Math.round(Number(sMetric.win === "a" ? sMetric.b : sMetric.a)) }));
    }
  }
  // Best app-store rating sentence.
  const appRows = metrics.filter((m) => (m.key === "google_play" || m.key === "app_store") && m.win && m.win !== "tie");
  const appWinner = appRows.length && appRows.every((m) => m.win === appRows[0].win) ? appRows[0].win : null;
  if (appWinner) paras.push(t("prose.ratings", { name: (appWinner === "a" ? a : b).name }));
  // Regulation sentence (exchanges).
  if (type === "exchange") {
    if (a.mica.licensed && b.mica.licensed) paras.push(t("prose.micaBoth"));
    else if (a.mica.licensed || b.mica.licensed) {
      const w = a.mica.licensed ? a : b;
      const o = a.mica.licensed ? b : a;
      paras.push(t("prose.micaOne", { name: w.name, other: o.name, regulator: w.mica.regulator ?? "-" }));
    } else paras.push(t("prose.micaNone"));
  }
  const total = aWins + bWins;
  if (total > 0) {
    if (aWins === bWins) paras.push(t("prose.verdictTie", { total }));
    else {
      const w = aWins > bWins ? a : b;
      paras.push(t("prose.verdict", { winner: w.name, count: Math.max(aWins, bWins), total }));
    }
  }

  const faqs = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
  ];
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  const ScoreStrip = ({ side }: { side: CompareSide }) => {
    const items: [string, number | null][] = [
      [t("category.sentiment"), side.sentiment],
      [t("metric.google_play"), side.ratings.google_play.rating != null ? side.ratings.google_play.rating * 20 : null],
      [t("metric.app_store"), side.ratings.app_store.rating != null ? side.ratings.app_store.rating * 20 : null],
      [t("metric.trustpilot"), side.ratings.trustpilot.rating != null ? side.ratings.trustpilot.rating * 20 : null],
    ];
    return (
      <div className="stack-8" style={{ maxWidth: 220, margin: "0 auto" }}>
        {items.map(([lbl, v]) => (
          <div key={lbl} className="spread" style={{ gap: 10 }}>
            <span className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3 }}>{lbl}</span>
            <div className="meter" style={{ width: 90 }}>
              {v != null && <span style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: scoreColor(v) }} />}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <main className="section" style={{ paddingTop: 24 }}>
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 8 }}>{t("eyebrow")}</p>
        <h1 className="h-sm">
          {a.name} <span className="muted" style={{ fontWeight: 400 }}>{t("vs")}</span> {b.name}
        </h1>
        <p className="lead" style={{ marginTop: 8, marginBottom: 24, maxWidth: 760 }}>
          {t("subtitle", { type: typeWord })}
        </p>

        {/* Winner boxes */}
        {winnerBoxes.length > 0 && (
          <div className="grid grid-4" style={{ marginBottom: 20 }}>
            {winnerBoxes.map((w) => (
              <div key={w.key} className="card card-tight">
                <div className="eyebrow" style={{ marginBottom: 4 }}>{t("bestOn", { category: t(`category.${w.key}`) })}</div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{w.win === "tie" ? t("tie") : (w.win === "a" ? a : b).name}</div>
              </div>
            ))}
          </div>
        )}

        {/* Comparison table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Head: logos + score strips + profile links */}
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr" }}>
            <div />
            {[a, b].map((side, i) => (
              <div key={side.id} style={{ padding: "20px 16px", textAlign: "center", borderLeft: i === 1 ? "1px solid var(--stone-border)" : undefined }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                  <BrandLogo src={side.logoSvg} website={side.website} name={side.name} size={44} />
                </div>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>{side.name}</div>
                <ScoreStrip side={side} />
                <Link href={`/${kindA}/${side.id}/`} className="pill pill-score" style={{ marginTop: 14, textDecoration: "none" }}>
                  {t("viewDetails", { name: side.name })}
                </Link>
              </div>
            ))}
          </div>

          {/* Sections */}
          {sections.map((g) => (
            <div key={g.s}>
              <div style={{ background: "var(--stone-canvas)", borderTop: "1px solid var(--stone-border)", borderBottom: "1px solid var(--stone-border)", padding: "8px 16px" }}>
                <span className="eyebrow">{t(`section.${g.s}`)}</span>
              </div>
              {g.rows.map((m) => (
                <div key={m.key} style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr", borderBottom: "1px solid var(--stone-border)", alignItems: "center" }}>
                  <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--warm-gray)", textTransform: "uppercase", letterSpacing: 0.3 }}>{t(`metric.${m.key}`)}</div>
                  <div style={cellStyle(m.win, "a")}>
                    {display(m, "a")}
                    {m.win === "a" && <div><span className="pill" style={{ background: "rgba(22,163,74,0.12)", color: GREEN, marginTop: 6 }}>{t("best")}</span></div>}
                  </div>
                  <div style={cellStyle(m.win, "b")}>
                    {display(m, "b")}
                    {m.win === "b" && <div><span className="pill" style={{ background: "rgba(22,163,74,0.12)", color: GREEN, marginTop: 6 }}>{t("best")}</span></div>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Prose summary */}
        <div className="card" style={{ marginTop: 24, maxWidth: 820 }}>
          <h2 className="subheading" style={{ marginBottom: 12 }}>{t("summaryTitle", { a: a.name, b: b.name })}</h2>
          <div className="stack-16">
            {paras.map((p, i) => (
              <p key={i} style={{ fontSize: 15, lineHeight: 1.65, color: "var(--ink-black)" }}>{p}</p>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginTop: 24, maxWidth: 820 }}>
          <div className="stack-8">
            {faqs.map((f, i) => (
              <div key={i} className="card card-tight">
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.q}</div>
                <div className="muted" style={{ fontSize: 14 }}>{f.a}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 13, marginTop: 24 }}>
          <Link href={type === "exchange" ? "/exchanges/" : "/neobanks/"} style={{ color: "var(--cyan-edge)" }}>{t("back", { type: typeWord })}</Link>
        </p>
        <p className="muted" style={{ fontSize: 11, marginTop: 16 }}>{t("disclaimer")}</p>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      </div>
    </main>
  );
}
