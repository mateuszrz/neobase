import { getLocale, getTranslations } from "next-intl/server";
import type { Report } from "@/lib/report/types";
import { ReportView } from "@/components/Report";

/* Project competitive report: the same rich 8-section Report the public teaser
 * shows, rendered fully unlocked (paid subscriber) with a generate/regenerate
 * control. Server component. */

export async function ProjectReportView({
  report,
  updatedAt,
  model,
  projectId,
  generate,
}: {
  report: Report | null;
  updatedAt: Date | null;
  model: string | null;
  projectId: string;
  generate: (formData: FormData) => void;
}) {
  const t = await getTranslations("panel");
  const locale = await getLocale();
  const when = updatedAt ? new Date(updatedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : null;

  return (
    <div style={{ marginTop: 20 }}>
      <div className="spread" style={{ alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 className="subheading" style={{ margin: 0 }}>{t("prMonthly")}</h2>
          {report && (
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
              {when ? t("prUpdated", { when }) : ""}{model && model !== "composed" ? " · Claude" : ""}
            </p>
          )}
        </div>
        <form action={generate}>
          <button className="btn btn-ghost" type="submit" style={{ fontSize: 13 }}>
            {report ? t("prRegen") : t("prGen")}
          </button>
        </form>
      </div>

      {!report ? (
        <p className="card muted" style={{ padding: 24, margin: 0 }}>{t("prNoReport")}</p>
      ) : (
        <ReportView report={report} unlocked id={projectId} unlock={generate} />
      )}
    </div>
  );
}
