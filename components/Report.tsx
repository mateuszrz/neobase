import type { Report, Severity } from "@/lib/report/types";

/* Rendering for a generated weekly report. The executive summary + brand focus
 * render free; everything below the fold is blurred behind an email gate until
 * unlocked. All server components — the unlock form posts a server action. */

const SEV_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };
const SEV_CLASS: Record<Severity, string> = { high: "pill-neg", medium: "pill-neutral", low: "pill-neutral" };

const DIR_LABEL: Record<string, string> = {
  improving: "Improving ▲",
  steady: "Steady →",
  softening: "Softening ▼",
};

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="row" style={{ gap: 10, marginBottom: 14, alignItems: "baseline" }}>
      <span className="eyebrow" style={{ margin: 0, color: "var(--cyan-edge)" }}>{String(n).padStart(2, "0")}</span>
      <h2 className="h-sm" style={{ margin: 0 }}>{title}</h2>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return <p className="muted" style={{ margin: 0 }}>Nothing notable this week.</p>;
  return (
    <ul className="stack-8" style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((t, i) => (
        <li key={i} style={{ lineHeight: 1.6 }}>{t}</li>
      ))}
    </ul>
  );
}

/* ─── Free sections ───────────────────────────────────────────────────────── */

function ExecSummary({ r }: { r: Report }) {
  return (
    <section className="card" style={{ padding: 24, borderLeft: "3px solid var(--cyan-signal)" }}>
      <SectionTitle n={1} title="Executive summary" />
      <Bullets items={r.execSummary} />
    </section>
  );
}

function BrandFocus({ r }: { r: Report }) {
  const f = r.brandFocus;
  return (
    <section className="card" style={{ padding: 24 }}>
      <SectionTitle n={2} title={r.brand} />
      <div className="row" style={{ gap: 20, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 500 }}>
            {f.rating != null ? `${f.rating.toFixed(1)}/5` : "—"}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>Cross-platform rating</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 500 }}>
            {f.sentimentDir ? DIR_LABEL[f.sentimentDir] : "—"}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>Customer sentiment</div>
        </div>
      </div>
      <SubBlock title="Main themes" items={f.themes} />
      <SubBlock title="Risks" items={f.risks} />
      <SubBlock title="Opportunities" items={f.opportunities} />
      <SubBlock title="Recommended actions" items={f.actions} />
    </section>
  );
}

function SubBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{title}</div>
      <Bullets items={items} />
    </div>
  );
}

/* ─── Gated sections ──────────────────────────────────────────────────────── */

function CompetitorMoves({ r }: { r: Report }) {
  if (!r.competitorMoves.length) return null;
  return (
    <section className="card" style={{ padding: 24 }}>
      <SectionTitle n={3} title="Competitor moves" />
      <div className="stack-16">
        {r.competitorMoves.map((c, i) => (
          <div key={i} style={{ paddingBottom: 16, borderBottom: i < r.competitorMoves.length - 1 ? "1px solid var(--stone-border)" : "none" }}>
            <div className="row" style={{ gap: 8, marginBottom: 6, alignItems: "center" }}>
              <strong>{c.name}</strong>
              <span className={`pill ${SEV_CLASS[c.severity]}`}>{SEV_LABEL[c.severity]}</span>
              {c.needsReaction && <span className="pill pill-neg">Needs reaction</span>}
            </div>
            <p style={{ margin: "0 0 4px", lineHeight: 1.6 }}>{c.whatHappened}</p>
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              Why it matters: {c.whyItMatters} · Impact on {r.brand}: {c.impact}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Products({ r }: { r: Report }) {
  if (!r.products.length) return null;
  return (
    <section className="card" style={{ padding: 24, overflowX: "auto" }}>
      <SectionTitle n={4} title="Products & partnerships" />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 640 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--warm-gray)" }}>
            {["Company", "Product / partnership", "Description", "Significance", `${r.brand} reaction`].map((h) => (
              <th key={h} style={{ padding: "8px 10px", borderBottom: "1px solid var(--stone-border)", fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.products.map((p, i) => (
            <tr key={i}>
              <td style={td}><strong>{p.company}</strong></td>
              <td style={td}>{p.item}</td>
              <td style={td}>{p.description}</td>
              <td style={td}>{p.significance}</td>
              <td style={td}>{p.reaction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const td = { padding: "10px", borderBottom: "1px solid var(--stone-border)", verticalAlign: "top", lineHeight: 1.5 } as const;

function ListSection({ n, title, items }: { n: number; title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="card" style={{ padding: 24 }}>
      <SectionTitle n={n} title={title} />
      <Bullets items={items} />
    </section>
  );
}

function Risks({ r }: { r: Report }) {
  if (!r.risks.length) return null;
  return (
    <section className="card" style={{ padding: 24 }}>
      <SectionTitle n={7} title="Risks & alerts" />
      <div className="stack-8">
        {r.risks.map((risk, i) => (
          <div key={i} className="row" style={{ gap: 10, alignItems: "baseline" }}>
            <span className={`pill ${SEV_CLASS[risk.severity]}`}>{SEV_LABEL[risk.severity]}</span>
            <span style={{ lineHeight: 1.6 }}>{risk.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Recommendations({ r }: { r: Report }) {
  const rec = r.recommendations;
  const blocks: [string, string[]][] = [
    ["Do now", rec.now],
    ["Watch", rec.watch],
    ["Product inspiration", rec.productInspiration],
    ["Marketing / PR inspiration", rec.marketingInspiration],
  ];
  if (blocks.every(([, v]) => !v.length)) return null;
  return (
    <section className="card" style={{ padding: 24 }}>
      <SectionTitle n={8} title={`Recommendations for ${r.brand}`} />
      <div className="grid grid-2" style={{ gap: 20 }}>
        {blocks.filter(([, v]) => v.length).map(([title, items]) => (
          <div key={title}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>{title}</div>
            <Bullets items={items} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Gate ────────────────────────────────────────────────────────────────── */

function Gate({ id, unlock }: { id: string; unlock: (formData: FormData) => void }) {
  return (
    <section className="card" style={{ padding: 28, textAlign: "center", background: "var(--stone-canvas)" }}>
      <h2 className="h-sm" style={{ marginBottom: 8 }}>Unlock the full report</h2>
      <p className="muted" style={{ maxWidth: 460, margin: "0 auto 20px", lineHeight: 1.6 }}>
        Competitor moves, products &amp; partnerships, marketing signals, risks and the full
        recommendation set. Enter your work email and we&apos;ll open it — and send you next
        week&apos;s.
      </p>
      <form action={unlock} className="row" style={{ gap: 8, maxWidth: 440, margin: "0 auto", justifyContent: "center" }}>
        <input type="hidden" name="id" value={id} />
        <input
          name="email"
          type="email"
          required
          placeholder="you@company.com"
          autoComplete="email"
          style={{ flex: 1, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--stone-border)", fontSize: 15 }}
        />
        <button className="btn btn-cyan" type="submit">Unlock</button>
      </form>
    </section>
  );
}

/* ─── Assembly ────────────────────────────────────────────────────────────── */

export function ReportView({
  report,
  unlocked,
  id,
  unlock,
}: {
  report: Report;
  unlocked: boolean;
  id: string;
  unlock: (formData: FormData) => void;
}) {
  return (
    <div className="stack-16">
      <ExecSummary r={report} />
      <BrandFocus r={report} />

      {unlocked ? (
        <>
          <CompetitorMoves r={report} />
          <Products r={report} />
          <ListSection n={5} title="Marketing, brand & PR" items={report.marketing} />
          <ListSection n={6} title="Strategic signals" items={report.signals} />
          <Risks r={report} />
          <Recommendations r={report} />
        </>
      ) : (
        <>
          <Gate id={id} unlock={unlock} />
          <div style={{ position: "relative" }}>
            <div style={{ filter: "blur(6px)", pointerEvents: "none", userSelect: "none" }} aria-hidden>
              <div className="stack-16">
                <CompetitorMoves r={report} />
                <ListSection n={5} title="Marketing, brand & PR" items={report.marketing} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
