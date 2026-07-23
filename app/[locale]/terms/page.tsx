import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { alternates } from "@/lib/i18n/alternates";
import { Markdown } from "@/components/Markdown";
import { getLegal } from "@/lib/legal/content";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return {
    title: t("termsTitle"),
    description: t("termsDesc"),
    alternates: alternates(locale, "/terms/"),
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { body } = getLegal("terms", locale);
  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <Markdown>{body}</Markdown>
      </div>
    </main>
  );
}
