import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { localeRedirect as redirect } from "@/lib/i18n/redirect";
import { getReportRequest, unlockReport } from "@/lib/report/generate";
import { sendReportEmail } from "@/lib/report/email";
import { ReportView } from "@/components/Report";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "report" });
  return { title: t("pageTitle"), robots: { index: false } }; // generated per-request; not for search
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("report");
  const data = await getReportRequest(id);
  if (!data) notFound();
  const { report, unlocked } = data;

  async function unlock(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const rid = String(formData.get("id") ?? "");
    if (!email || !rid) return;
    const res = await unlockReport(rid, email);
    if (res) {
      // Derive the public base URL from the request so the email links back correctly.
      const h = await headers();
      const host = h.get("x-forwarded-host") ?? h.get("host") ?? "neobase.co";
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      await sendReportEmail(email, rid, res.brand, `${proto}://${host}`);
    }
    return redirect(`/test/${rid}/`);
  }

  const generated = new Date(report.generatedAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  // The data note is rebuilt from the report's flags so it localizes (the stored
  // `report.dataNote` is whatever language the report was generated in).
  const note = !report.grounded ? t("noteNotTracked") : report.usesSampleMedia ? t("noteSample") : null;

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="spread" style={{ marginBottom: 8, alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <p className="eyebrow" style={{ margin: 0 }}>{t("eyebrow")}</p>
          <span className="muted" style={{ fontSize: 13 }}>{generated} · {t("lastDays", { days: report.periodDays })}</span>
        </div>
        <h1 className="display" style={{ fontSize: "2.2rem", marginBottom: 6 }}>{report.brand}</h1>
        {report.competitors.length > 0 && (
          <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
            vs {report.competitors.join(" · ")}
          </p>
        )}

        {note && (
          <p
            className="muted"
            style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 24, padding: "12px 16px", borderRadius: 8, background: "var(--stone-canvas)", border: "1px solid var(--stone-border)" }}
          >
            {report.grounded ? "ℹ️ " : "⚠️ "}{note}
          </p>
        )}

        <ReportView report={report} unlocked={unlocked} id={id} unlock={unlock} />

        <p className="muted" style={{ fontSize: 12, marginTop: 28, textAlign: "center" }}>
          {t("groundedNote")}{" "}
          <Link href="/test/" style={{ color: "var(--cyan-edge)" }}>{t("runAnother")}</Link>
        </p>
      </div>
    </main>
  );
}
