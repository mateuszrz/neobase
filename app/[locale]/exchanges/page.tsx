import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listExchanges } from "@/lib/queries";
import { alternates } from "@/lib/i18n/alternates";
import { FintechCard } from "@/components/ui";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "directory" });
  return {
    title: t("exchangesMetaTitle"),
    description: t("exchangesMetaDesc"),
    alternates: alternates(locale, "/exchanges/"),
  };
}

export default async function ExchangesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("directory");
  const list = await listExchanges();
  return (
    <main className="section">
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 12 }}>{t("eyebrow")}</p>
        <h1 className="h-sm">{t("exchangesTitle")}</h1>
        <p className="lead" style={{ marginTop: 10, marginBottom: 16 }}>
          {t("exchangesLead", { count: list.length })}
        </p>
        <p style={{ marginBottom: 28 }}>
          <Link href="/exchanges/mica/" className="btn btn-ghost">{t("micaCta")}</Link>
        </p>
        <div className="grid grid-3">
          {list.map((f) => (
            <FintechCard key={f.id} f={f} kind="exchange" />
          ))}
        </div>
      </div>
    </main>
  );
}
