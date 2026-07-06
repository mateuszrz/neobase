import type { ReactNode } from "react";
import type { FintechListItem, PlatformRating } from "@/lib/queries";

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
        <a className="btn btn-ghost nav-hide-sm" href="/neobanks/">Explore</a>
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
      {f.logoSvg ? (
        <img className="flogo" src={f.logoSvg} alt="" loading="lazy" />
      ) : (
        <div className="flogo" aria-hidden />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <h3>{f.name}</h3>
        <p className="sub">
          {flagEmoji(f.country)} {f.country ?? "Global"}
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

/** A row of per-platform rating tiles (Trustpilot / Google Play / App Store). */
export function PlatformRatings({ items }: { items: PlatformRating[] }) {
  const shown = items.filter((p) => p.rating != null);
  if (!shown.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`, gap: 12 }}>
      {shown.map((p) => {
        const m = PLATFORM_META[p.kind] ?? { label: p.kind, accent: "var(--ash-gray)" };
        return (
          <div key={p.kind} className="card" style={{ padding: 16 }}>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: m.accent, flex: "0 0 auto" }} />
              <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>{m.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {p.rating!.toFixed(1)}
              <span style={{ fontSize: 15, color: m.accent }}> ★</span>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {p.count != null ? `${fmt(p.count)} ratings` : "—"}
              {/* App Store sentiment is from a recent-review sample (Apple exposes no
                  rating histogram), unlike Google Play's lifetime breakdown. */}
              {p.pos != null && ` · ${p.pos.toFixed(0)}% positive${p.kind === "app_store" ? " (recent)" : ""}`}
            </div>
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

export function SeriesChart({
  points,
}: {
  points: { date: string; rating: number | null; count: number | null }[];
}) {
  const W = 820;
  const H = 260;
  const PAD = { t: 24, r: 16, b: 28, l: 16 };
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

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Trustpilot rating and review count over time">
      {[1, 2, 3, 4, 5].map((r) => (
        <g key={r}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yRating(r)} y2={yRating(r)} stroke="var(--stone-border)" strokeWidth={1} />
          <text x={W - PAD.r} y={yRating(r) - 3} textAnchor="end" fontSize={10} fill="var(--ash-gray)">
            {r}★
          </text>
        </g>
      ))}
      <path d={areaFill} fill="var(--sky-wash)" opacity={0.5} />
      <path d={countLine} fill="none" stroke="var(--ash-gray)" strokeWidth={1.5} strokeDasharray="3 3" />
      <path d={ratingLine} fill="none" stroke="var(--cyan-signal)" strokeWidth={2.5} />
      {last.rating != null && <circle cx={x(n - 1)} cy={yRating(last.rating)} r={4} fill="var(--cyan-signal)" />}
      <text x={PAD.l} y={14} fontSize={11} fill="var(--cyan-edge)">
        ● TrustScore
      </text>
      <text x={PAD.l + 96} y={14} fontSize={11} fill="var(--warm-gray)">
        ┄ Review count
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
  return (
    <div className="stack-8">
      {rows.map(([star, v]) => {
        const pct = Math.round(((v || 0) / total) * 100);
        return (
          <div key={star} className="row" style={{ gap: 10 }}>
            <span style={{ width: 28, fontSize: 12, color: "var(--warm-gray)" }}>{star}★</span>
            <div className="meter" style={{ flex: 1 }}>
              <span style={{ width: `${pct}%`, background: star >= 4 ? "var(--cyan-signal)" : star === 3 ? "var(--ash-gray)" : "var(--neg)" }} />
            </div>
            <span style={{ width: 36, textAlign: "right", fontSize: 12, color: "var(--warm-gray)" }}>{pct}%</span>
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
  const H = 200;
  const PAD = { t: 20, r: 16, b: 24, l: 16 };
  const withData = points.filter((p) => p.pos != null);
  if (withData.length < 2) return <p className="muted">Sentiment history accrues daily.</p>;

  const n = points.length;
  const x = (i: number) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b);

  const line = points
    .map((p, i) => (p.pos == null ? null : `${i === 0 ? "M" : "L"}${x(i)},${y(p.pos)}`))
    .filter(Boolean)
    .join(" ");
  const area = `${line} L${x(n - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`;
  const last = points[n - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Positive sentiment over time">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--stone-border)" strokeWidth={1} />
          <text x={W - PAD.r} y={y(v) - 3} textAnchor="end" fontSize={10} fill="var(--ash-gray)">{v}%</text>
        </g>
      ))}
      <path d={area} fill="var(--sky-wash)" opacity={0.6} />
      <path d={line} fill="none" stroke="var(--cyan-signal)" strokeWidth={2.5} />
      {last.pos != null && <circle cx={x(n - 1)} cy={y(last.pos)} r={4} fill="var(--cyan-signal)" />}
      <text x={PAD.l} y={13} fontSize={11} fill="var(--cyan-edge)">● Positive sentiment %</text>
    </svg>
  );
}
