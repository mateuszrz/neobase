import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { alternates } from "@/lib/i18n/alternates";
import { localeRedirect as redirect } from "@/lib/i18n/redirect";
import { generateReport } from "@/lib/report/generate";
import { clientIp, withinRateLimit, RATE_MAX, RATE_WINDOW_MIN } from "@/lib/report/rate-limit";
import { getAllFintechs } from "@/lib/queries";
import { CompetitorPicker } from "@/components/CompetitorPicker";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "test" });
  return { title: t("metaTitle"), description: t("metaDesc"), alternates: alternates(locale, "/test/") };
}

export const revalidate = 3600;
// The submit action calls Claude synchronously — give the function headroom
// beyond the default so a slow generation can't be killed mid-request.
export const maxDuration = 60;

export default async function TestReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ slow?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("test");
  const { slow } = await searchParams;
  const brands = await getAllFintechs();
  const options = brands.map((b) => ({ id: b.id, name: b.name, country: b.country, logoSvg: b.logoSvg }));

  async function run(formData: FormData) {
    "use server";
    const brand = String(formData.get("brand") ?? "").trim();
    if (!brand) return;
    // Competitors are picked from the tracked list → we receive their ids.
    const competitors = formData
      .getAll("competitorIds")
      .map((v) => String(v).trim())
      .filter(Boolean)
      .slice(0, 8); // cap the fan-out

    const ip = await clientIp();
    if (!(await withinRateLimit(ip))) return redirect("/test/?slow=1");

    const { id } = await generateReport(brand, competitors, ip, locale);
    return redirect(`/test/${id}/`);
  }

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>{t("eyebrow")}</p>
        <h1 className="display" style={{ fontSize: "2.4rem" }}>
          {t.rich("headline", { hl: (c) => <span className="hl">{c}</span> })}
        </h1>
        <p className="lead" style={{ marginTop: 18, marginBottom: 32, maxWidth: 560 }}>
          {t("lead")}
        </p>

        {slow && (
          <p
            className="stack-8"
            style={{ padding: "12px 16px", borderRadius: 8, marginBottom: 20, background: "var(--stone-canvas)", border: "1px solid var(--neg)", color: "var(--neg)", fontSize: 14, lineHeight: 1.6 }}
          >
            {t.rich("rateLimited", {
              max: RATE_MAX,
              minutes: RATE_WINDOW_MIN,
              link: (c) => <Link href="/monitoring/" style={{ color: "inherit", textDecoration: "underline" }}>{c}</Link>,
            })}
          </p>
        )}

        <form action={run} className="card stack-16" style={{ padding: 24 }}>
          <label className="stack-8" style={{ display: "block" }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>{t("yourBrand")}</span>
            <input
              name="brand"
              required
              placeholder={t("brandPlaceholder")}
              autoComplete="organization"
              style={inputStyle}
            />
          </label>

          <CompetitorPicker options={options} max={8} />

          <button className="btn btn-cyan" type="submit" style={{ justifyContent: "center" }}>
            {t("submit")}
          </button>
        </form>

        <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
          {t("grounded")}
        </p>
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid var(--stone-border, #e5e0d8)",
  fontSize: 15,
  background: "var(--stone-canvas, #fff)",
} as const;
