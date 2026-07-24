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

        <section style={{ marginTop: 48 }}>
          <h2 className="h-sm" style={{ fontSize: "1.3rem", marginBottom: 18 }}>{t("authorHeading")}</h2>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", padding: 24, border: "1px solid var(--stone-border)", borderRadius: 12 }}>
            <div
              aria-hidden
              style={{
                flex: "0 0 auto", width: 60, height: 60, borderRadius: "50%",
                background: "var(--ink-black)", color: "var(--pure-white)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 500,
              }}
            >
              MR
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 500 }}>Mateusz Rzetecki</div>
              <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{t("authorRole")}</div>
              <p style={{ fontSize: "0.95rem", lineHeight: 1.65, margin: 0 }}>{t("authorBio")}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
