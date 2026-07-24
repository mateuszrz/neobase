import { getTranslations } from "next-intl/server";
import type { Report, Severity } from "@/lib/report/types";

/* Rendering for a generated weekly report. The executive summary + brand focus
 * render free; everything below the fold is blurred behind an email gate until
 * unlocked. All server components — the unlock form posts a server action.
 * Section labels are localized; the report *content* is generated in the
 * reader's language at request time (see lib/report/generate.ts). */

const SEV_KEY: Record<Severity, string> = { high: "sevHigh", medium: "sevMedium", low: "sevLow" };
const SEV_CLASS: Record<Severity, string> = { high: "pill-neg", medium: "pill-neutral", low: "pill-neutral" };
const DIR_KEY: Record<string, string> = { improving: "dirImproving", steady: "dirSteady", softening: "dirSoftening" };

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="row" style={{ gap: 10, marginBottom: 14, alignItems: "baseline" }}>
      <span className="eyebrow" style={{ margin: 0, color: "var(--cyan-edge)" }}>{String(n).padStart(2, "0")}</span>
      <h2 className="h-sm" style={{ margin: 0 }}>{title}</h2>
    </div>
  );
}

async function Bullets({ items }: { items: string[] }) {
  if (!items.length) {
    const t = await getTranslations("report");
    return <p className="muted" style={{ margin: 0 }}>{t("nothingNotable")}</p>;
  }
  return (
    <ul className="stack-8" style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((t, i) => (
        <li key={i} style={{ lineHeight: 1.6 }}>{t}</li>
      ))}
    </ul>
  );
}

/* ─── Free sections ───────────────────────────────────────────────────────── */

async function ExecSummary({ r }: { r: Report }) {
  const t = await getTranslations("report");
  return (
    <section className="card" style={{ padding: 24, borderLeft: "3px solid var(--cyan-signal)" }}>
      <SectionTitle n={1} title={t("execSummary")} />
      <Bullets items={r.execSummary} />
    </section>
  );
}

async function BrandFocus({ r }: { r: Report }) {
  const t = await getTranslations("report");
  const f = r.brandFocus;
  return (
    <section className="card" style={{ padding: 24 }}>
      <SectionTitle n={2} title={r.brand} />
      <div className="row" style={{ gap: 20, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 500 }}>
            {f.rating != null ? `${f.rating.toFixed(1)}/5` : "-"}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>{t("crossPlatformRating")}</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 500 }}>
            {f.sentimentDir ? t(DIR_KEY[f.sentimentDir]) : "-"}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>{t("customerSentiment")}</div>
        </div>
      </div>
      <SubBlock title={t("mainThemes")} items={f.themes} />
      <SubBlock title={t("risks")} items={f.risks} />
      <SubBlock title={t("opportunities")} items={f.opportunities} />
      <SubBlock title={t("recommendedActions")} items={f.actions} />
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

async function CompetitorMoves({ r }: { r: Report }) {
  if (!r.competitorMoves.length) return null;
  const t = await getTranslations("report");
  return (
    <section className="card" style={{ padding: 24 }}>
      <SectionTitle n={3} title={t("competitorMoves")} />
      <div className="stack-16">
        {r.competitorMoves.map((c, i) => (
          <div key={i} style={{ paddingBottom: 16, borderBottom: i < r.competitorMoves.length - 1 ? "1px solid var(--stone-border)" : "none" }}>
            <div className="row" style={{ gap: 8, marginBottom: 6, alignItems: "center" }}>
              <strong>{c.name}</strong>
              <span className={`pill ${SEV_CLASS[c.severity]}`}>{t(SEV_KEY[c.severity])}</span>
              {c.needsReaction && <span className="pill pill-neg">{t("needsReaction")}</span>}
            </div>
            <p style={{ margin: "0 0 4px", lineHeight: 1.6 }}>{c.whatHappened}</p>
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              {t("whyImpact", { why: c.whyItMatters, brand: r.brand, impact: c.impact })}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

async function Products({ r }: { r: Report }) {
  if (!r.products.length) return null;
  const t = await getTranslations("report");
  const headers = [t("thCompany"), t("thProduct"), t("thDescription"), t("thSignificance"), t("thReaction", { brand: r.brand })];
  return (
    <section className="card" style={{ padding: 24, overflowX: "auto" }}>
      <SectionTitle n={4} title={t("products")} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 640 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--warm-gray)" }}>
            {headers.map((h) => (
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

async function Risks({ r }: { r: Report }) {
  if (!r.risks.length) return null;
  const t = await getTranslations("report");
  return (
    <section className="card" style={{ padding: 24 }}>
      <SectionTitle n={7} title={t("risksAlerts")} />
      <div className="stack-8">
        {r.risks.map((risk, i) => (
          <div key={i} className="row" style={{ gap: 10, alignItems: "baseline" }}>
            <span className={`pill ${SEV_CLASS[risk.severity]}`}>{t(SEV_KEY[risk.severity])}</span>
            <span style={{ lineHeight: 1.6 }}>{risk.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

async function Recommendations({ r }: { r: Report }) {
  const t = await getTranslations("report");
  const rec = r.recommendations;
  const blocks: [string, string[]][] = [
    [t("doNow"), rec.now],
    [t("watch"), rec.watch],
    [t("productInspiration"), rec.productInspiration],
    [t("marketingInspiration"), rec.marketingInspiration],
  ];
  if (blocks.every(([, v]) => !v.length)) return null;
  return (
    <section className="card" style={{ padding: 24 }}>
      <SectionTitle n={8} title={t("recommendationsFor", { brand: r.brand })} />
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

async function Gate({ id, unlock }: { id: string; unlock: (formData: FormData) => void }) {
  const t = await getTranslations("report");
  return (
    <section className="card" style={{ padding: 28, textAlign: "center", background: "var(--stone-canvas)" }}>
      <h2 className="h-sm" style={{ marginBottom: 8 }}>{t("unlockTitle")}</h2>
      <p className="muted" style={{ maxWidth: 460, margin: "0 auto 20px", lineHeight: 1.6 }}>
        {t("unlockBody")}
      </p>
      <form action={unlock} className="row" style={{ gap: 8, maxWidth: 440, margin: "0 auto", justifyContent: "center" }}>
        <input type="hidden" name="id" value={id} />
        <input
          name="email"
          type="email"
          required
          placeholder={t("emailPlaceholder")}
          autoComplete="email"
          style={{ flex: 1, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--stone-border)", fontSize: 15 }}
        />
        <button className="btn btn-cyan" type="submit">{t("unlock")}</button>
      </form>
    </section>
  );
}

/* ─── Assembly ────────────────────────────────────────────────────────────── */

export async function ReportView({
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
  const t = await getTranslations("report");
  return (
    <div className="stack-16">
      <ExecSummary r={report} />
      <BrandFocus r={report} />

      {unlocked ? (
        <>
          <CompetitorMoves r={report} />
          <Products r={report} />
          <ListSection n={5} title={t("marketingPR")} items={report.marketing} />
          <ListSection n={6} title={t("strategicSignals")} items={report.signals} />
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
                <ListSection n={5} title={t("marketingPR")} items={report.marketing} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
