import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Highlight } from "@/components/ui";
import { routing } from "@/i18n/routing";
import { alternates } from "@/lib/i18n/alternates";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: alternates(locale, "/about/"),
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>{t("eyebrow")}</p>
        <h1 className="display">{t.rich("headline", { hl: (c) => <Highlight>{c}</Highlight> })}</h1>
        <div className="stack-16" style={{ marginTop: 24 }}>
          <p className="lead">{t("p1")}</p>
          <p className="lead">{t("p2")}</p>
        </div>
      </div>
    </main>
  );
}
