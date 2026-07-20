import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";
import { getBestForTag } from "@/lib/queries";
import { tagBySlug, TAGS } from "@/lib/tags";
import { BrandLogo } from "@/components/BrandLogo";
import { flagEmoji } from "@/components/ui";

export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => TAGS.map((t) => ({ locale, slug: t.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const tag = tagBySlug(slug);
  if (!tag) return { title: "Ranking not found" };
  const tt = await getTranslations({ locale, namespace: "tags" });
  const t = await getTranslations({ locale, namespace: "rankings" });
  return {
    title: t("pageTitle", { title: tt(`${tag.slug}.title`) }),
    description: t("pageDesc", { blurb: tt(`${tag.slug}.blurb`) }),
    // Trailing slash: trailingSlash: true serves /best/x/, so a canonical
    // without one points at a redirect.
    alternates: {
      canonical: locale === routing.defaultLocale ? `/best/${tag.slug}/` : `/${locale}/best/${tag.slug}/`,
    },
  };
}

function scoreColor(v: number): string {
  if (v >= 80) return "#16a34a";
  if (v >= 60) return "var(--cyan-edge)";
  if (v >= 40) return "#b45309";
  return "var(--neg)";
}

export default async function BestPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const tag = tagBySlug(slug);
  if (!tag) notFound();
  const t = await getTranslations("rankings");
  const tt = await getTranslations("tags");

  const rows = await getBestForTag(tag.match, tag.group);
  const kind = tag.group === "exchange" ? "exchange" : "fintech";
  const backHref = tag.group === "exchange" ? "/exchanges/" : "/neobanks/";

  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: tt(`${tag.slug}.title`),
    itemListElement: rows.map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.name, url: `${env.APP_BASE_URL.replace(/\/$/, "")}/${kind}/${r.id}/` })),
  };

  return (
    <main className="section" style={{ paddingTop: 24 }}>
      <div className="wrap">
        <p style={{ fontSize: 13, marginBottom: 12 }}>
          <Link href="/best/" style={{ color: "var(--cyan-edge)" }}>← {t("allRankings")}</Link>
        </p>
        <p className="eyebrow" style={{ marginBottom: 10 }}>{tag.group === "exchange" ? t("exchanges") : t("neobanks")} · {t("eyebrow")}</p>
        <h1 className="h-sm">{tt(`${tag.slug}.title`)}</h1>
        <p className="lead" style={{ marginTop: 10, marginBottom: 24, maxWidth: 760 }}>
          {tt(`${tag.slug}.blurb`)} {t("optionCount", { count: rows.length })}
        </p>

        {rows.length === 0 ? (
          <p className="muted">{t("noOptions")} <Link href={backHref} style={{ color: "var(--cyan-edge)" }}>{t("browseAll")}</Link></p>
        ) : (
          <div className="stack-8" style={{ maxWidth: 760 }}>
            {rows.map((r, i) => (
              <Link
                key={r.id}
                href={`/${kind}/${r.id}/`}
                className="card"
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", textDecoration: "none", color: "inherit" }}
              >
                <span style={{ flex: "0 0 auto", width: 26, textAlign: "center", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: i < 3 ? "var(--ink-black)" : "var(--ash-gray)" }}>{i + 1}</span>
                <BrandLogo src={r.logoSvg} website={r.website} name={r.name} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {r.country ? `${flagEmoji(r.country)} ` : ""}{r.reviewCount != null ? t("reviewCount", { count: r.reviewCount }) : "—"}
                  </div>
                </div>
                {r.sentiment != null ? (
                  <span style={{ flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: scoreColor(r.sentiment) }} title="NeoBase sentiment score">
                    {r.sentiment.toFixed(0)}
                  </span>
                ) : (
                  <span className="muted" style={{ flex: "0 0 auto" }}>—</span>
                )}
              </Link>
            ))}
          </div>
        )}

        <p className="muted" style={{ fontSize: 11, marginTop: 24 }}>
          {t("rankedBy")}
        </p>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      </div>
    </main>
  );
}
