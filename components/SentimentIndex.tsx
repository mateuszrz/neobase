import type { SentimentIndexView } from "@/lib/sentiment";
import { Delta } from "@/components/ui";

/* NeoBase composite sentiment index: the 0–100 score, week-over-week change,
 * and a weekly trend sparkline. Server component. The methodology (which
 * sources feed the score and their weights) is deliberately not shown on the
 * public brand page. */

function Spark({ points }: { points: { week: string; composite: number }[] }) {
  if (points.length < 2) return null;
  const W = 260;
  const H = 56;
  const P = 6;
  const vals = points.map((p) => p.composite);
  const lo = Math.max(0, Math.floor(Math.min(...vals) - 3));
  const hi = Math.min(100, Math.ceil(Math.max(...vals) + 3));
  const span = hi - lo || 1;
  const n = points.length;
  const x = (i: number) => P + (i / (n - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - lo) / span) * (H - 2 * P);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.composite).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
  const last = points[n - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Sentiment index trend" style={{ maxWidth: W }}>
      <defs>
        <linearGradient id="siFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--sky-wash)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--sky-wash)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#siFill)" />
      <path d={line} fill="none" stroke="var(--cyan-signal)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(n - 1)} cy={y(last.composite)} r={3} fill="var(--cyan-signal)" stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}

export function SentimentIndexCard({ data }: { data: SentimentIndexView }) {
  const { latest, deltaWoW, series } = data;
  return (
    <div className="card" style={{ marginTop: 20, borderLeft: "3px solid var(--cyan-signal)" }}>
      <div className="spread" style={{ marginBottom: 14, alignItems: "baseline" }}>
        <h2 className="subheading">Sentiment index</h2>
        <span className="muted" style={{ fontSize: 12 }}>our score · updated weekly</span>
      </div>

      <div className="row" style={{ gap: 24, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", fontWeight: 500, lineHeight: 1 }}>
              {latest.composite.toFixed(1)}
            </span>
            <span className="muted" style={{ fontSize: 15 }}>/100</span>
          </div>
          <div style={{ marginTop: 6 }}>
            {deltaWoW != null ? (
              <Delta value={deltaWoW} since="last week" />
            ) : (
              <span className="muted" style={{ fontSize: 13 }}>first reading — change shows next week</span>
            )}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Spark points={series} />
        </div>
      </div>
    </div>
  );
}
