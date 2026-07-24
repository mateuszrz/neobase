import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { alternates } from "@/lib/i18n/alternates";
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
    alternates: alternates(locale, `/best/${tag.slug}/`),
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
  // Featured (editor's pick) rows are pinned first by the query; they render
  // above rank 1 with no number, so the visible ranking counts non-featured only.
  const featuredCount = rows.filter((r) => r.featured).length;
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
        <p className="lead" style={{ marginTop: 10, marginBottom: 18, maxWidth: 760 }}>
          {tt(`${tag.slug}.blurb`)} {t("optionCount", { count: rows.length })}
        </p>

        {rows.length > 0 && (
          <div className="card" style={{ padding: "15px 18px", marginBottom: 18, maxWidth: 880 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <div style={{ maxWidth: 470 }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{t("scoreName")}</div>
                <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{t("scoreExplain")}</p>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {([["#16a34a", t("tierExcellent"), "80+"], ["var(--cyan-edge)", t("tierGood"), "60–79"], ["#b45309", t("tierMixed"), "40–59"], ["var(--neg)", t("tierWeak"), "<40"]] as const).map(([c, label, range]) => (
                  <div key={range} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: c, flex: "none" }} />
                    <span style={{ fontWeight: 600 }}>{label}</span>
                    <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>{range}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="muted">{t("noOptions")} <Link href={backHref} style={{ color: "var(--cyan-edge)" }}>{t("browseAll")}</Link></p>
        ) : (
          <div className="stack-8" style={{ maxWidth: 880 }}>
            {rows.map((r, i) => {
              const rank = r.featured ? null : i - featuredCount + 1;
              const medal = rank === 1 ? "#eab308" : rank === 2 ? "#9ca3af" : rank === 3 ? "#c2703d" : null;
              return (
                <Link
                  key={r.id}
                  href={`/${kind}/${r.id}/`}
                  className="card"
                  style={{ display: "grid", gridTemplateColumns: "34px 44px minmax(0,1fr) auto", alignItems: "center", gap: 14, padding: "13px 18px", textDecoration: "none", color: "inherit" }}
                >
                  <span
                    style={{
                      justifySelf: "center", width: 28, height: 28, borderRadius: "var(--r-full)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700,
                      color: r.featured ? "var(--cyan-edge)" : medal ? "#fff" : "var(--ash-gray)",
                      background: medal ?? "transparent",
                    }}
                  >
                    {r.featured ? "★" : rank}
                  </span>
                  <BrandLogo src={r.logoSvg} website={r.website} name={r.name} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{r.name}</span>
                      {r.featured && <span className="badge" style={{ borderColor: "var(--cyan-edge)", color: "var(--cyan-edge)" }}>★ {t("featured")}</span>}
                      {r.country && <span className="muted" style={{ fontSize: 12 }}>{flagEmoji(r.country)} {r.country}</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 1, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {r.rating != null && <span><span style={{ color: "var(--cyan-signal)" }}>★</span> {r.rating.toFixed(1)}</span>}
                      {r.rating != null && r.reviewCount != null && <span aria-hidden>·</span>}
                      {r.reviewCount != null && <span>{t("reviewCount", { count: r.reviewCount })}</span>}
                      {r.rating == null && r.reviewCount == null && <span>-</span>}
                    </div>
                    {r.sentiment != null && (
                      <div className="meter" style={{ marginTop: 9, height: 10 }}>
                        <span style={{ width: `${Math.max(3, Math.min(100, r.sentiment))}%`, background: scoreColor(r.sentiment), boxShadow: `0 0 8px -2px ${scoreColor(r.sentiment)}` }} />
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", maxWidth: 104 }}>
                    {r.sentiment != null ? (
                      <>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 700, lineHeight: 1, color: scoreColor(r.sentiment) }}>
                          {r.sentiment.toFixed(0)}<span className="muted" style={{ fontSize: 12, fontWeight: 400 }}> / 100</span>
                        </div>
                        <div className="muted" style={{ fontSize: 9.5, marginTop: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>{t("scoreName")}</div>
                      </>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </div>
                </Link>
              );
            })}
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
