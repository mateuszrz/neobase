import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { listArticles } from "@/lib/blog/articles";

export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: locale === routing.defaultLocale ? "/blog/" : `/${locale}/blog/` },
  };
}

export default async function BlogIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const posts = await listArticles(locale);

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>{t("title")}</p>
        <h1 className="h-sm">{t("title")}</h1>
        <p className="lead" style={{ marginTop: 10, marginBottom: 28 }}>{t("description")}</p>

        {posts.length === 0 ? (
          <p className="muted">{t("empty")}</p>
        ) : (
          <div className="stack-16">
            {posts.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}/`}
                className="card"
                style={{ display: "block", textDecoration: "none", color: "inherit" }}
              >
                <h2 className="subheading" style={{ marginBottom: 6 }}>{p.title}</h2>
                {p.publishedAt && (
                  <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
                    {/* Locale-aware date — the reader's language, not "en" */}
                    {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(p.publishedAt)}
                  </p>
                )}
                {p.excerpt && <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>{p.excerpt}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
