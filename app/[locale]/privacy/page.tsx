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
    title: t("privacyTitle"),
    description: t("privacyDesc"),
    alternates: alternates(locale, "/privacy/"),
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { body } = getLegal("privacy", locale);
  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <Markdown>{body}</Markdown>
      </div>
    </main>
  );
}
