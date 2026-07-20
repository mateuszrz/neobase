import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getTagCounts } from "@/lib/queries";
import { TAGS, tagsForGroup } from "@/lib/tags";

export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rankings" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    // With a trailing slash — trailingSlash: true serves /best/, so a canonical
    // of "/best" points at a URL that only 308s.
    alternates: { canonical: locale === routing.defaultLocale ? "/best/" : `/${locale}/best/` },
  };
}

export default async function RankingsIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("rankings");
  const tt = await getTranslations("tags");
  const counts = await getTagCounts();
  const sizeOf = (tag: (typeof TAGS)[number]) =>
    tag.match.reduce((s, raw) => s + (counts.get(`${tag.group}:${raw}`) ?? 0), 0);

  return (
    <main className="section" style={{ paddingTop: 24 }}>
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 10 }}>{t("eyebrow")}</p>
        <h1 className="h-sm">{t("title")}</h1>
        <p className="lead" style={{ marginTop: 10, marginBottom: 28, maxWidth: 760 }}>{t("metaDesc")}</p>

        {(["neobank", "exchange"] as const).map((group) => (
          <section key={group} style={{ marginBottom: 32 }}>
            <h2 className="subheading" style={{ marginBottom: 14 }}>
              {group === "neobank" ? t("neobanks") : t("exchanges")}
            </h2>
            <div className="grid grid-3">
              {tagsForGroup(group).map((tag) => (
                <Link
                  key={tag.slug}
                  href={`/best/${tag.slug}/`}
                  className="card"
                  style={{ textDecoration: "none", color: "inherit", padding: 18 }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{tt(`${tag.slug}.title`)}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{t("optionCount", { count: sizeOf(tag) })}</div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
