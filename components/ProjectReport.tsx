import type { ProjectReportDoc } from "@/lib/projects/report";

/* Monthly project report display + generate button. Server component. */

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="stack-8" style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((t, i) => (
        <li key={i} style={{ lineHeight: 1.6 }}>{t}</li>
      ))}
    </ul>
  );
}

export function ProjectReportView({
  report,
  updatedAt,
  model,
  generate,
}: {
  report: ProjectReportDoc | null;
  updatedAt: Date | null;
  model: string | null;
  generate: (formData: FormData) => void;
}) {
  const when = updatedAt ? new Date(updatedAt).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" }) : null;

  return (
    <div className="card" style={{ marginTop: 20, padding: 24, borderLeft: "3px solid var(--cyan-signal)" }}>
      <div className="spread" style={{ alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <h2 className="subheading" style={{ margin: 0 }}>✦ Monthly report</h2>
        <form action={generate}>
          <button className="btn btn-ghost" type="submit" style={{ fontSize: 13 }}>
            {report ? "Regenerate" : "Generate report"}
          </button>
        </form>
      </div>

      {!report ? (
        <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
          No report yet. Generate a Claude digest of this month&apos;s rating, sentiment and competitor-change signals across your brands &amp; markets.
        </p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0, marginBottom: 16, fontSize: 12 }}>
            Last {report.periodDays} days{when ? ` · updated ${when}` : ""}{model && model !== "composed" ? " · Claude" : ""}
          </p>

          {report.dataNote && (
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "var(--stone-canvas)", border: "1px solid var(--stone-border)" }}>
              ℹ️ {report.dataNote}
            </p>
          )}

          {report.execSummary.length > 0 && (
            <>
              <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Executive summary</div>
              <Bullets items={report.execSummary} />
            </>
          )}

          {report.brandHighlights.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>By brand</div>
              <div className="stack-8">
                {report.brandHighlights.map((h, i) => (
                  <p key={i} style={{ margin: 0, lineHeight: 1.6 }}>
                    <strong>{h.brand}:</strong> <span className="muted">{h.text}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {report.recommendations.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Recommendations</div>
              <Bullets items={report.recommendations} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
