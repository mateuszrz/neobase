import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("verifyMetaTitle"), description: t("verifyMetaDesc") };
}

export default async function VerifyRequestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("login");

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 420 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>{t("account")}</p>
        <h1 className="display" style={{ fontSize: "2rem" }}>{t("verifyTitle")}</h1>
        <p className="lead" style={{ marginTop: 16, fontSize: 16 }}>{t("verifyLead")}</p>
        <p className="muted" style={{ marginTop: 24, fontSize: 13 }}>
          {t.rich("verifyRetry", {
            retry: (c) => (
              <Link href="/login/" style={{ color: "var(--cyan-signal)" }}>
                {c}
              </Link>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
