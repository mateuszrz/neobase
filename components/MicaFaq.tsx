import { getTranslations } from "next-intl/server";

/* FAQ block for the MiCA registry page. Server-rendered <details> accordion +
 * a FAQPage JSON-LD block so Google can surface the Q&As as rich results.
 * Numbers in Q2/Q3 are interpolated live from the register so the copy never
 * drifts from the data. */

export async function MicaFaq({ total, countries, tradingPlatforms }: { total: number; countries: number; tradingPlatforms: number }) {
  const t = await getTranslations("micaPage");
  const vars = { count: total, countries, tp: tradingPlatforms };

  const qa = [
    { q: t("faqQ1"), a: t("faqA1") },
    { q: t("faqQ2"), a: t("faqA2", vars) },
    { q: t("faqQ3"), a: t("faqA3", vars) },
    { q: t("faqQ4"), a: t("faqA4") },
    { q: t("faqQ5"), a: t("faqA5") },
    { q: t("faqQ6"), a: t("faqA6") },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <section style={{ marginTop: 44 }}>
      <h2 className="h-sm" style={{ fontSize: "1.4rem", marginBottom: 16 }}>{t("faqTitle")}</h2>
      <div style={{ maxWidth: 760 }}>
        {qa.map(({ q, a }, i) => (
          <details key={i} style={{ borderTop: "1px solid var(--stone-border)", padding: "12px 0" }}>
            <summary style={{ cursor: "pointer", fontWeight: 500, fontSize: 14.5, listStyle: "none" }}>{q}</summary>
            <p className="muted" style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.6 }}>{a}</p>
          </details>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
