import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getReportRequest, unlockReport } from "@/lib/report/generate";
import { sendReportEmail } from "@/lib/report/email";
import { ReportView } from "@/components/Report";

export const metadata: Metadata = {
  title: "Your weekly competitive brief",
  robots: { index: false }, // generated per-request; not for search
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    redirect(`/test/${rid}`);
  }

  const generated = new Date(report.generatedAt).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="spread" style={{ marginBottom: 8, alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <p className="eyebrow" style={{ margin: 0 }}>Weekly competitive brief</p>
          <span className="muted" style={{ fontSize: 13 }}>{generated} · last {report.periodDays} days</span>
        </div>
        <h1 className="display" style={{ fontSize: "2.2rem", marginBottom: 6 }}>{report.brand}</h1>
        {report.competitors.length > 0 && (
          <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
            vs {report.competitors.join(" · ")}
          </p>
        )}

        {report.dataNote && (
          <p
            className="muted"
            style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 24, padding: "12px 16px", borderRadius: 8, background: "var(--stone-canvas)", border: "1px solid var(--stone-border)" }}
          >
            {report.grounded ? "ℹ️ " : "⚠️ "}{report.dataNote}
          </p>
        )}

        <ReportView report={report} unlocked={unlocked} id={id} unlock={unlock} />

        <p className="muted" style={{ fontSize: 12, marginTop: 28, textAlign: "center" }}>
          Grounded in real cross-platform ratings and customer-sentiment data — we never invent events.{" "}
          <a href="/test/" style={{ color: "var(--cyan-edge)" }}>Run another brand →</a>
        </p>
      </div>
    </main>
  );
}
