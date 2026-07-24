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
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", padding: 24, border: "1px solid var(--stone-border)", borderRadius: 12 }}>
            <img
              src="/team/mateusz-rzetecki.jpg"
              alt="Mateusz Rzetecki"
              width={84}
              height={84}
              loading="lazy"
              style={{ flex: "0 0 auto", width: 84, height: 84, borderRadius: "50%", objectFit: "cover" }}
            />
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 500 }}>Mateusz Rzetecki</div>
              <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t("authorRole")}</div>
              <div className="stack-16">
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem", lineHeight: 1.65, color: "var(--warm-gray)", margin: 0 }}>{t("authorBio")}</p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem", lineHeight: 1.65, color: "var(--warm-gray)", margin: 0 }}>{t("authorBio2")}</p>
              </div>
              <a
                href="https://linkedin.com/in/mateuszrzetecki"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-block", marginTop: 14, fontSize: 13, color: "var(--cyan-edge)" }}
              >
                LinkedIn ↗
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
