import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Markdown } from "@/components/Markdown";
import { getArticle, allPublishedArticleParams, readingMinutes } from "@/lib/blog/articles";
import { env } from "@/lib/env";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    return await allPublishedArticleParams();
  } catch {
    // DB unreachable at build time — fall back to on-demand rendering rather
    // than failing the build, same as the profile routes do.
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getArticle(locale, slug);
  if (!post) return { title: "Not found" };
  const path = locale === routing.defaultLocale ? `/blog/${slug}/` : `/${locale}/blog/${slug}/`;
  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt ?? undefined,
      publishedTime: post.publishedAt?.toISOString(),
      images: post.coverUrl ? [post.coverUrl] : undefined,
      url: path,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await getArticle(locale, slug);
  if (!post) notFound();

  const t = await getTranslations("blog");
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const base = env.APP_BASE_URL.replace(/\/$/, "");
  const path = locale === routing.defaultLocale ? `/blog/${slug}/` : `/${locale}/blog/${slug}/`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    inLanguage: locale,
    image: post.coverUrl ?? undefined,
    author: { "@type": post.author ? "Person" : "Organization", name: post.author ?? "NeoBase" },
    publisher: { "@type": "Organization", name: "NeoBase" },
    mainEntityOfPage: `${base}${path}`,
  };

  return (
    <main className="section" style={{ paddingTop: 24 }}>
      <article className="wrap" style={{ maxWidth: 720 }}>
        <p style={{ fontSize: 13, marginBottom: 12 }}>
          <Link href="/blog/" style={{ color: "var(--cyan-edge)" }}>← {t("backToBlog")}</Link>
        </p>

        <h1 className="h-sm" style={{ marginBottom: 10 }}>{post.title}</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 24 }}>
          {post.publishedAt && dateFmt.format(post.publishedAt)}
          {post.author && ` · ${post.author}`}
          {` · ${readingMinutes(post.bodyMd)} min`}
        </p>

        {post.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverUrl}
            alt=""
            style={{ width: "100%", height: "auto", borderRadius: "var(--r-card)", marginBottom: 28 }}
          />
        )}

        <Markdown>{post.bodyMd}</Markdown>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      </article>
    </main>
  );
}
