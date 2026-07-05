import type { ReactNode } from "react";
import type { FintechListItem } from "@/lib/queries";

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
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
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
