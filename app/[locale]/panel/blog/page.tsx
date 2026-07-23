import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { listAllArticles } from "@/lib/blog/articles";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blog", robots: { index: false, follow: false } };

export default async function BlogAdminList({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("panel");
  // 404 rather than redirect: a customer poking at /panel/blog/ shouldn't learn
  // the editor exists.
  if (!(await isAdmin())) notFound();
  const posts = await listAllArticles();

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>{t("editorial")}</p>
        <div className="spread" style={{ alignItems: "baseline" }}>
          <h1 className="display" style={{ fontSize: "2rem" }}>{t("blogPosts")}</h1>
          <Link className="btn btn-cyan" href="/panel/blog/new/">{t("newPost")}</Link>
        </div>

        {posts.length === 0 ? (
          <p className="muted" style={{ marginTop: 20 }}>{t("noPosts")}</p>
        ) : (
          <div className="stack-8" style={{ marginTop: 20 }}>
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/panel/blog/${p.id}/`}
                className="card row spread"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span>
                  <strong>{p.title}</strong>
                  <span className="muted" style={{ fontSize: 13 }}> · {p.locale} · /{p.slug}/</span>
                </span>
                <span className={`pill ${p.status === "published" ? "pill-score" : "pill-neutral"}`}>{p.status}</span>
              </Link>
            ))}
          </div>
        )}

        <p className="muted" style={{ fontSize: 12, marginTop: 28 }}>
          {t("localesNote", { locales: routing.locales.join(", ") })}
        </p>
      </div>
    </main>
  );
}
