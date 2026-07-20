import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { listAllArticles } from "@/lib/blog/articles";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blog", robots: { index: false, follow: false } };

export default async function BlogAdminList() {
  // 404 rather than redirect: a customer poking at /panel/blog/ shouldn't learn
  // the editor exists.
  if (!(await isAdmin())) notFound();
  const posts = await listAllArticles();

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>Editorial</p>
        <div className="spread" style={{ alignItems: "baseline" }}>
          <h1 className="display" style={{ fontSize: "2rem" }}>Blog posts</h1>
          <Link className="btn btn-cyan" href="/panel/blog/new/">New post</Link>
        </div>

        {posts.length === 0 ? (
          <p className="muted" style={{ marginTop: 20 }}>No posts yet.</p>
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
          Locales: {routing.locales.join(", ")}. Each language is its own post — a Polish article
          does not need an English counterpart.
        </p>
      </div>
    </main>
  );
}
