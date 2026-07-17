import type { ReactNode } from "react";
import type { FintechListItem, PlatformRating } from "@/lib/queries";
import { BrandLogo } from "@/components/BrandLogo";

/* ─── Brand / chrome ──────────────────────────────────────────────────────── */

export function Nav() {
  return (
    <nav className="nav">
      <div className="wrap nav-inner">
        <a href="/" className="brand" aria-label="NeoBase home">
          <svg className="brand-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
          </svg>
          NeoBase
        </a>
        <a className="nav-link nav-hide-sm" href="/neobanks/">Neobanks</a>
        <a className="nav-link nav-hide-sm" href="/exchanges/">Exchanges</a>
        <a className="nav-link nav-hide-sm" href="/about/">About</a>
        <a className="btn btn-ghost nav-hide-sm" href="/test/">Test our reports</a>
        <a className="btn btn-cyan" href="/monitoring/">Get monitoring</a>
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap spread">
        <div className="row" style={{ gap: 8 }}>
          <span style={{ fontWeight: 600, color: "var(--ink-black)" }}>NeoBase</span>
          <span>· Independent fintech intelligence</span>
        </div>
        <div className="row" style={{ gap: 16 }}>
          <a href="/neobanks/">Neobanks</a>
          <a href="/exchanges/">Exchanges</a>
          <a href="/about/">About</a>
          <span className="muted">© 2026</span>
        </div>
      </div>
    </footer>
  );
}

export function Highlight({ children }: { children: ReactNode }) {
  return <span className="hl">{children}</span>;
}

/* ─── Bits ────────────────────────────────────────────────────────────────── */

export function flagEmoji(cc?: string | null): string {
  if (!cc || cc.length !== 2 || cc === "ZZ") return "🌍";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function Stars({ rating }: { rating: number | null }) {
  const r = Math.round((rating ?? 0) * 2) / 2;
  return (
    <span className="stars" aria-label={rating ? `${rating} out of 5` : "no rating"}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(r) ? "" : "off"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function TrustScore({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="pill pill-neutral">No score yet</span>;
  return (
    <span className="pill pill-score">
      ★ {rating.toFixed(1)} <span style={{ opacity: 0.7 }}>TrustScore</span>
    </span>
  );
}

export function Stat({ num, label }: { num: string; label: string }) {
  return (
    <div className="stat">
      <div className="num">{num}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

export function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  const s = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${s}${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${s}${(a / 1_000).toFixed(a >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

export function fmtMoney(usd: number | null | undefined): string {
  if (usd == null) return "—";
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(usd >= 1e10 ? 0 : 1)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(0)}M`;
  return `$${usd.toLocaleString()}`;
}

/**
 * Human-friendly reply time. The Trustpilot actor returns values like "0.77 days"
 * or a bare number of days; render sub-day spans in hours ("~18h") instead.
 */
export function fmtReplyTime(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const s = String(v).trim();
  const m = s.match(/^([\d.]+)\s*(minute|min|hour|hr|day|week|month)s?\b/i);
  const n = m ? parseFloat(m[1]) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return s; // unrecognised format — show as-is
  const unit = (m?.[2] ?? "day").toLowerCase();
  const hoursPer: Record<string, number> = { minute: 1 / 60, min: 1 / 60, hour: 1, hr: 1, day: 24, week: 168, month: 720 };
  const hours = n * (hoursPer[unit] ?? 24);
  if (hours < 1) return "< 1h";
  if (hours < 24) return `~${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 7) return `~${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"}`;
  const weeks = days / 7;
  return `~${Math.round(weeks)} week${Math.round(weeks) === 1 ? "" : "s"}`;
}

/** Directional change chip: ▲ green-ish / ▼ warn / — flat, with an optional context label. */
export function Delta({
  value,
  suffix = "",
  since,
  good = "up",
}: {
  value: number | null;
  suffix?: string;
  since?: string;
  good?: "up" | "down";
}) {
  if (value == null) return <span className="muted">—</span>;
  const up = value > 0;
  const flat = value === 0;
  const positive = flat ? null : (good === "up" ? up : !up);
  const color = positive == null ? "var(--ash-gray)" : positive ? "var(--cyan-edge)" : "var(--neg)";
  const arrow = flat ? "→" : up ? "▲" : "▼";
  const val = `${up ? "+" : ""}${value % 1 === 0 ? value : value.toFixed(2)}${suffix}`;
  return (
    <span style={{ color, fontSize: 13, fontWeight: 500 }}>
      {arrow} {val}
      {since && <span className="muted" style={{ fontWeight: 400 }}> vs {since}</span>}
    </span>
  );
}

export function FintechCard({ f, kind = "neobank" }: { f: FintechListItem; kind?: "neobank" | "exchange" }) {
  const href = `/${kind === "exchange" ? "exchange" : "fintech"}/${f.id}/`;
  return (
    <a className="fcard" href={href}>
      <BrandLogo src={f.logoSvg} name={f.name} size={44} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <h3>{f.name}</h3>
        <p className="sub">
          {f.country ?? "Global"}
          {f.reviewCount != null && ` · ${fmt(f.reviewCount)} reviews`}
        </p>
      </div>
      {f.rating != null && <span className="pill pill-score">★ {f.rating.toFixed(1)}</span>}
    </a>
  );
}

/* ─── Cross-platform ratings ──────────────────────────────────────────────── */

const PLATFORM_META: Record<string, { label: string; accent: string }> = {
  trustpilot: { label: "Trustpilot", accent: "var(--cyan-signal)" },
  google_play: { label: "Google Play", accent: "#34a853" },
  app_store: { label: "App Store", accent: "var(--ink-black)" },
};

// Monochrome platform glyphs (star / play / apple) — recognisable but restrained.
const PLATFORM_PATH: Record<string, string> = {
  trustpilot: "M12 2l2.94 6.26L22 9.24l-5 4.73L18.18 21 12 17.27 5.82 21 7 13.97l-5-4.73 7.06-.98L12 2z",
  google_play: "M5 3l14 9-14 9V3z",
  app_store:
    "M17.05 12.04c-.03-2.6 2.13-3.85 2.23-3.91-1.22-1.78-3.11-2.02-3.78-2.05-1.61-.16-3.14.95-3.96.95-.81 0-2.07-.93-3.41-.9-1.75.03-3.37 1.02-4.27 2.59-1.82 3.16-.47 7.83 1.31 10.39.87 1.25 1.9 2.66 3.25 2.61 1.31-.05 1.8-.85 3.38-.85 1.58 0 2.02.85 3.4.82 1.4-.03 2.29-1.28 3.15-2.54.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.73-1.05-2.76-4.16zM14.53 5.42c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.09 3.18 1.15.09 2.32-.58 3.04-1.45z",
};

/** "10,000,000+" → "10M+". */
function fmtInstalls(s: string): string {
  const n = parseInt(String(s).replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return s;
  return `${fmt(n).replace(/\.0([KM])/, "$1")}${String(s).includes("+") ? "+" : ""}`;
}

function PlatformIcon({ kind, color }: { kind: string; color: string }) {
  const d = PLATFORM_PATH[kind];
  if (!d) return <span style={{ width: 9, height: 9, borderRadius: 999, background: color, flex: "0 0 auto" }} />;
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={color} aria-hidden style={{ flex: "0 0 auto" }}>
      <path d={d} />
    </svg>
  );
}

/** A row of per-platform rating tiles (Trustpilot / Google Play / App Store). */
export function PlatformRatings({ items }: { items: PlatformRating[] }) {
  const shown = items.filter((p) => p.rating != null);
  if (!shown.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
      {shown.map((p) => {
        const m = PLATFORM_META[p.kind] ?? { label: p.kind, accent: "var(--ash-gray)" };
        const pos = p.pos;
        return (
          <div key={p.kind} className="card" style={{ padding: 20 }}>
            <div className="row" style={{ gap: 8, marginBottom: 14 }}>
              <PlatformIcon kind={p.kind} color={m.accent} />
              <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>{m.label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "2.1rem", fontWeight: 500, lineHeight: 1 }}>
                {p.rating!.toFixed(1)}
              </span>
              <span style={{ fontSize: 16, color: m.accent }}>★</span>
            </div>
            {pos != null && (
              <div className="meter" style={{ marginTop: 14 }}>
                <span style={{ width: `${Math.max(0, Math.min(100, pos))}%`, background: m.accent }} />
              </div>
            )}
            <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              {p.count != null ? `${fmt(p.count)} ratings` : "—"}
              {pos != null && ` · ${pos.toFixed(0)}% positive`}
            </div>
            {p.installs && (
              <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{fmtInstalls(p.installs)} installs</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Sentiment meter ─────────────────────────────────────────────────────── */

export function SentimentMeter({ pos }: { pos: number | null }) {
  const p = pos ?? 0;
  return (
    <div>
      <div className="spread" style={{ marginBottom: 6 }}>
        <span className="muted" style={{ fontSize: 13 }}>Positive sentiment</span>
        <span style={{ fontWeight: 500 }}>{pos == null ? "—" : `${pos.toFixed(0)}%`}</span>
      </div>
      <div className="meter">
        <span style={{ width: `${Math.max(0, Math.min(100, p))}%` }} />
      </div>
    </div>
  );
}

/* ─── Time-series chart (Seline-styled inline SVG) ────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtMonth(d: string): string {
  const [y, m] = d.split("-");
  return `${MONTHS[parseInt(m, 10) - 1] ?? m} '${(y ?? "").slice(2)}`;
}

export function SeriesChart({
  points,
}: {
  points: { date: string; rating: number | null; count: number | null }[];
}) {
  const W = 820;
  const H = 280;
  const PAD = { t: 26, r: 20, b: 40, l: 16 };
  const rated = points.filter((p) => p.rating != null);
  if (rated.length < 2) {
    return <p className="muted">Not enough history yet — data accrues daily.</p>;
  }

  const n = points.length;
  const x = (i: number) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r);
  const yRating = (r: number) => PAD.t + (1 - (r - 1) / 4) * (H - PAD.t - PAD.b);

  const counts = points.map((p) => p.count ?? 0);
  const minC = Math.min(...counts);
  const maxC = Math.max(...counts);
  const yCount = (c: number) => PAD.t + (1 - (c - minC) / Math.max(1, maxC - minC)) * (H - PAD.t - PAD.b);

  const ratingLine = points
    .map((p, i) => (p.rating == null ? null : `${i === 0 ? "M" : "L"}${x(i)},${yRating(p.rating)}`))
    .filter(Boolean)
    .join(" ");
  const countLine = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${yCount(p.count ?? 0)}`).join(" ");
  const areaFill = `${countLine} L${x(n - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`;

  const last = points[n - 1];
  const ticks = [...new Set([0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1])];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="TrustScore and review volume over time">
      <defs>
        <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--sky-wash)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--sky-wash)" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      {/* rating gridlines (1–5★) */}
      {[1, 2, 3, 4, 5].map((r) => (
        <g key={r}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yRating(r)} y2={yRating(r)} stroke="var(--stone-border)" strokeWidth={1} />
          <text x={W - PAD.r} y={yRating(r) - 4} textAnchor="end" fontSize={10} fill="var(--ash-gray)">
            {r}★
          </text>
        </g>
      ))}

      {/* review-volume area + edge */}
      <path d={areaFill} fill="url(#volFill)" />
      <path d={countLine} fill="none" stroke="var(--stone-muted)" strokeWidth={1.5} strokeLinejoin="round" />

      {/* TrustScore line + endpoint callout */}
      <path d={ratingLine} fill="none" stroke="var(--cyan-signal)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {last.rating != null && (
        <>
          <circle cx={x(n - 1)} cy={yRating(last.rating)} r={4} fill="var(--cyan-signal)" stroke="#fff" strokeWidth={1.5} />
          <text x={x(n - 1) - 8} y={yRating(last.rating) - 9} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--cyan-edge)">
            {last.rating.toFixed(1)}★
          </text>
        </>
      )}

      {/* x-axis date labels */}
      {ticks.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 14}
          textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          fontSize={10}
          fill="var(--ash-gray)"
        >
          {fmtMonth(points[i].date)}
        </text>
      ))}

      {/* legend */}
      <text x={PAD.l} y={14} fontSize={11} fill="var(--cyan-edge)">● TrustScore</text>
      <text x={PAD.l + 92} y={14} fontSize={11} fill="var(--warm-gray)">
        ▬ Review volume{last.count != null ? ` · ${fmt(last.count)}` : ""}
      </text>
    </svg>
  );
}

/** Lifetime 1–5★ rating distribution. */
export function RatingDistribution({ dist }: { dist: { s1: number; s2: number; s3: number; s4: number; s5: number } }) {
  const rows: [number, number][] = [
    [5, dist.s5],
    [4, dist.s4],
    [3, dist.s3],
    [2, dist.s2],
    [1, dist.s1],
  ];
  const total = rows.reduce((a, [, v]) => a + (v || 0), 0) || 1;
  const barColor = (star: number) => (star >= 4 ? "var(--cyan-signal)" : star === 3 ? "var(--ash-gray)" : "var(--neg)");
  return (
    <div className="stack-8">
      {rows.map(([star, v]) => {
        const pct = ((v || 0) / total) * 100;
        const shown = Math.round(pct);
        return (
          <div key={star} className="row" style={{ gap: 12 }} title={`${star}★ — ${fmt(v || 0)} ratings (${shown}%)`}>
            <span style={{ width: 22, fontSize: 12, color: "var(--warm-gray)", fontVariantNumeric: "tabular-nums" }}>{star}★</span>
            <div style={{ flex: 1, height: 10, borderRadius: "var(--r-full)", background: "var(--stone-border)", overflow: "hidden" }}>
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${v > 0 ? Math.max(2.5, pct) : 0}%`,
                  background: barColor(star),
                  borderRadius: "var(--r-full)",
                }}
              />
            </div>
            <span style={{ width: 78, textAlign: "right", fontSize: 12, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
              {shown}%<span className="muted" style={{ fontWeight: 400 }}> · {fmt(v || 0)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Small labelled figure row for responsiveness stats. */
export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "1.3rem" }}>{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}

/** Positive-sentiment share over time (0–100%). */
export function SentimentChart({ points }: { points: { date: string; pos: number | null }[] }) {
  const W = 820;
  const H = 220;
  const PAD = { t: 22, r: 20, b: 36, l: 16 };
  const withData = points.filter((p) => p.pos != null);
  if (withData.length < 2) return <p className="muted">Sentiment history accrues daily.</p>;

  // Auto-scale the y-axis to the data range — lifetime sentiment moves subtly,
  // so a fixed 0–100 axis would flatten the trend into a line at the top.
  const vals = withData.map((p) => p.pos as number);
  const lo = Math.max(0, Math.floor(Math.min(...vals) - 2));
  let hi = Math.min(100, Math.ceil(Math.max(...vals) + 2));
  if (hi - lo < 4) hi = Math.min(100, lo + 4);

  const n = points.length;
  const x = (i: number) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);

  const line = points
    .map((p, i) => (p.pos == null ? null : `${i === 0 ? "M" : "L"}${x(i)},${y(p.pos)}`))
    .filter(Boolean)
    .join(" ");
  const area = `${line} L${x(n - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`;
  const last = points[n - 1];
  const ticks = [...new Set([0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1])];
  const gridVals = [...new Set([hi, Math.round((lo + hi) / 2), lo])];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Positive sentiment over time">
      <defs>
        <linearGradient id="sentFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--sky-wash)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--sky-wash)" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      {gridVals.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--stone-border)" strokeWidth={1} />
          <text x={W - PAD.r} y={y(v) - 4} textAnchor="end" fontSize={10} fill="var(--ash-gray)">{v}%</text>
        </g>
      ))}
      <path d={area} fill="url(#sentFill)" />
      <path d={line} fill="none" stroke="var(--cyan-signal)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {last.pos != null && (
        <>
          <circle cx={x(n - 1)} cy={y(last.pos)} r={4} fill="var(--cyan-signal)" stroke="#fff" strokeWidth={1.5} />
          <text x={x(n - 1) - 8} y={y(last.pos) - 9} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--cyan-edge)">
            {last.pos.toFixed(0)}%
          </text>
        </>
      )}
      {ticks.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 12}
          textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          fontSize={10}
          fill="var(--ash-gray)"
        >
          {fmtMonth(points[i].date)}
        </text>
      ))}
      <text x={PAD.l} y={13} fontSize={11} fill="var(--cyan-edge)">● Positive sentiment</text>
    </svg>
  );
}

/** Positive-sentiment trend per platform (multi-line, auto-scaled). */
export function PlatformSentimentChart({
  series,
}: {
  series: { kind: string; points: { date: string; pos: number }[] }[];
}) {
  const allDates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  if (allDates.length < 2) return <p className="muted">Sentiment history accrues daily.</p>;
  const idx = new Map(allDates.map((d, i) => [d, i]));
  const n = allDates.length;

  const vals = series.flatMap((s) => s.points.map((p) => p.pos));
  const lo = Math.max(0, Math.floor(Math.min(...vals) - 2));
  let hi = Math.min(100, Math.ceil(Math.max(...vals) + 2));
  if (hi - lo < 4) hi = Math.min(100, lo + 4);

  const W = 820;
  const H = 240;
  const PAD = { t: 16, r: 20, b: 36, l: 16 };
  const x = (i: number) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks = [...new Set([0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1])];
  const gridVals = [...new Set([hi, Math.round((lo + hi) / 2), lo])];

  return (
    <>
      <div className="row" style={{ gap: 16, marginBottom: 12 }}>
        {series.map((s) => {
          const m = PLATFORM_META[s.kind] ?? { label: s.kind, accent: "var(--ash-gray)" };
          const last = s.points[s.points.length - 1];
          return (
            <span key={s.kind} className="row" style={{ gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: m.accent, flex: "0 0 auto" }} />
              <span className="muted" style={{ fontSize: 12 }}>
                {m.label}
                {last ? ` · ${last.pos.toFixed(0)}%` : ""}
              </span>
            </span>
          );
        })}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Positive sentiment per platform over time">
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--stone-border)" strokeWidth={1} />
            <text x={W - PAD.r} y={y(v) - 4} textAnchor="end" fontSize={10} fill="var(--ash-gray)">{v}%</text>
          </g>
        ))}
        {series.map((s) => {
          const m = PLATFORM_META[s.kind] ?? { label: s.kind, accent: "var(--ash-gray)" };
          const pts = s.points.filter((p) => idx.has(p.date));
          if (!pts.length) return null;
          const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(idx.get(p.date)!)},${y(p.pos)}`).join(" ");
          const last = pts[pts.length - 1];
          return (
            <g key={s.kind}>
              <path d={line} fill="none" stroke={m.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {pts.length === 1 && <circle cx={x(idx.get(pts[0].date)!)} cy={y(pts[0].pos)} r={3} fill={m.accent} />}
              <circle cx={x(idx.get(last.date)!)} cy={y(last.pos)} r={3.5} fill={m.accent} stroke="#fff" strokeWidth={1.5} />
            </g>
          );
        })}
        {ticks.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 12}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            fontSize={10}
            fill="var(--ash-gray)"
          >
            {fmtMonth(allDates[i])}
          </text>
        ))}
      </svg>
    </>
  );
}

// ─── Social feed + news (public content preview) ─────────────────────────────

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.max(0, Math.round((Date.now() - then) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

const NET_LABEL: Record<string, string> = { linkedin: "LinkedIn", facebook: "Facebook" };
const NET_COLOR: Record<string, string> = { linkedin: "#0a66c2", facebook: "#1877f2" };

/** Publisher favicon via Google's favicon service (falls back to a globe). */
export function faviconUrl(domain: string, size = 64): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

function Avatar({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <span
      aria-hidden={!src}
      style={{
        width: 36,
        height: 36,
        borderRadius: 9,
        flex: "0 0 auto",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        background: "var(--stone-canvas)",
        border: "1px solid var(--stone-border)",
      }}
    >
      {src ? <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : null}
    </span>
  );
}

export function SocialFeed({
  posts,
  name,
  logo,
}: {
  posts: { network: string; text: string; postedAt: string; likes: number; comments: number; shares: number; url: string | null }[];
  name: string;
  logo?: string | null;
}) {
  return (
    <div className="stack-16">
      {posts.map((p, i) => (
        <div key={i} className="row" style={{ gap: 12, alignItems: "flex-start", paddingBottom: 16, borderBottom: i < posts.length - 1 ? "1px solid var(--stone-border)" : "none" }}>
          <BrandLogo src={logo} name={name} size={36} radius={9} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ gap: 8, marginBottom: 6, alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>{name}</strong>
              <span style={{ fontSize: 11, fontWeight: 600, color: NET_COLOR[p.network] ?? "var(--stone-muted)" }}>
                {NET_LABEL[p.network] ?? p.network}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>· {timeAgo(p.postedAt)}</span>
            </div>
            <p style={{ margin: "0 0 10px", lineHeight: 1.6 }}>
              {p.url ? (
                <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>{p.text}</a>
              ) : (
                p.text
              )}
            </p>
            <div className="row muted" style={{ gap: 18, fontSize: 12 }}>
              <span>♡ {fmt(p.likes)}</span>
              <span>💬 {fmt(p.comments)}</span>
              <span>↻ {fmt(p.shares)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const SENT_COLOR: Record<string, string> = { positive: "var(--pos)", negative: "var(--neg)", neutral: "var(--stone-muted)" };

export function NewsList({
  items,
}: {
  items: { title: string; publisher: string; domain: string | null; publishedAt: string; snippet: string; sentiment: string; url: string | null }[];
}) {
  return (
    <div className="stack-16">
      {items.map((n, i) => (
        <div key={i} className="row" style={{ gap: 12, alignItems: "flex-start", paddingBottom: 16, borderBottom: i < items.length - 1 ? "1px solid var(--stone-border)" : "none" }}>
          <Avatar src={n.domain ? faviconUrl(n.domain) : null} alt={n.publisher || "source"} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 4px", fontWeight: 500, lineHeight: 1.4 }}>
              {n.url ? (
                <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>{n.title}</a>
              ) : (
                n.title
              )}
            </p>
            <p className="muted row" style={{ margin: "0 0 6px", fontSize: 12, gap: 7, alignItems: "center" }}>
              <span
                title={n.sentiment}
                style={{ width: 7, height: 7, borderRadius: "50%", background: SENT_COLOR[n.sentiment] ?? "var(--stone-muted)", flex: "0 0 auto" }}
              />
              {n.publisher}{n.publisher ? " · " : ""}{timeAgo(n.publishedAt)}
            </p>
            {n.snippet && <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{n.snippet}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BlogList({
  items,
  name,
  logo,
}: {
  items: { title: string; url: string | null; publishedAt: string; snippet: string }[];
  name: string;
  logo?: string | null;
}) {
  return (
    <div className="stack-16">
      {items.map((p, i) => (
        <div key={i} className="row" style={{ gap: 12, alignItems: "flex-start", paddingBottom: 16, borderBottom: i < items.length - 1 ? "1px solid var(--stone-border)" : "none" }}>
          <BrandLogo src={logo} name={name} size={36} radius={9} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 4px", fontWeight: 500, lineHeight: 1.4 }}>
              {p.url ? (
                <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>{p.title}</a>
              ) : (
                p.title
              )}
            </p>
            <p className="muted" style={{ margin: "0 0 6px", fontSize: 12 }}>{name} · {timeAgo(p.publishedAt)}</p>
            {p.snippet && <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{p.snippet}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── AI weekly brief ─────────────────────────────────────────────────────────

export function AiBrief({ text, isSample, updatedAt }: { text: string; isSample: boolean; updatedAt: Date | null }) {
  const when = updatedAt ? new Date(updatedAt).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" }) : null;
  return (
    <div
      className="card"
      style={{ marginTop: 24, borderLeft: "3px solid var(--cyan-signal)", background: "var(--stone-canvas)" }}
    >
      <div className="spread" style={{ marginBottom: 10, alignItems: "center" }}>
        <span className="eyebrow" style={{ margin: 0, color: "var(--cyan-edge)" }}>✦ AI brief</span>
        {isSample ? (
          <span className="pill pill-neutral" title="Preview — refreshed weekly once live">Sample</span>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>Updated weekly{when ? ` · ${when}` : ""}</span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7 }}>{text}</p>
    </div>
  );
}
