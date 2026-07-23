import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { revalidateArticle } from "@/lib/blog/revalidate";
import { eq } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { localeRedirect as redirect } from "@/lib/i18n/redirect";
import { isAdmin, requireAdmin } from "@/lib/auth/admin";
import { db, schema } from "@/lib/db";
import { getArticleById, slugify } from "@/lib/blog/articles";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit post", robots: { index: false, follow: false } };

const { articles } = schema;

/** Shape a submitted form into a row, deriving the slug from the title if blank. */
function readForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  return {
    locale: String(formData.get("locale") ?? routing.defaultLocale),
    title,
    slug: slugify(slugRaw || title),
    excerpt: String(formData.get("excerpt") ?? "").trim() || null,
    bodyMd: String(formData.get("bodyMd") ?? ""),
    coverUrl: String(formData.get("coverUrl") ?? "").trim() || null,
    author: String(formData.get("author") ?? "").trim() || null,
    seoTitle: String(formData.get("seoTitle") ?? "").trim() || null,
    seoDescription: String(formData.get("seoDescription") ?? "").trim() || null,
    status: String(formData.get("status") ?? "draft") === "published" ? "published" : "draft",
  };
}

/**
 * Publishing writes to the public site, so every one of these actions calls
 * requireAdmin() itself. A server action is its own POST endpoint — guarding
 * only the page that renders the form would leave the mutation callable by
 * any authenticated customer.
 */
async function save(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = Number(formData.get("id") ?? 0);
  const v = readForm(formData);
  if (!v.title || !v.slug) return redirect(`/panel/blog/${id || "new"}/?error=title`);

  // published_at is stamped on first publish and then left alone, so editing a
  // live post doesn't shuffle it to the top of the feed.
  const publishing = v.status === "published";
  const existing = id ? await getArticleById(id) : null;
  const publishedAt = publishing ? (existing?.publishedAt ?? new Date()) : existing?.publishedAt ?? null;

  let savedId = id;
  try {
    if (existing) {
      await db.update(articles).set({ ...v, publishedAt, updatedAt: new Date() }).where(eq(articles.id, id));
    } else {
      const [row] = await db.insert(articles).values({ ...v, publishedAt }).returning({ id: articles.id });
      savedId = row.id;
    }
  } catch (e) {
    // The (locale, slug) unique index is the likely culprit.
    if (String(e).includes("articles_locale_slug")) return redirect(`/panel/blog/${id || "new"}/?error=slug`);
    throw e;
  }

  // The public routes are ISR with revalidate=3600; without this an editor
  // would publish and then not see the post for up to an hour. The sitemap is
  // ISR too, which this used to forget — see lib/blog/revalidate.ts.
  await revalidateArticle(v.locale, v.slug);

  return redirect(`/panel/blog/${savedId}/?saved=1`);
}

async function remove(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  const existing = id ? await getArticleById(id) : null;
  if (existing) {
    await db.delete(articles).where(eq(articles.id, id));
    await revalidateArticle(existing.locale, existing.slug);
  }
  return redirect("/panel/blog/");
}

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--stone-border)",
  fontSize: 15,
  fontFamily: "inherit",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 5 }}>{label}</span>
      {children}
      {hint && <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

export default async function BlogEditor({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  if (!(await isAdmin())) notFound();

  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("panel");
  const { saved, error } = await searchParams;
  const isNew = id === "new";
  const post = isNew ? null : await getArticleById(Number(id));
  if (!isNew && !post) notFound();

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <p style={{ fontSize: 13, marginBottom: 12 }}>
          <Link href="/panel/blog/" style={{ color: "var(--cyan-edge)" }}>{t("allPosts")}</Link>
        </p>
        <h1 className="h-sm" style={{ marginBottom: 20 }}>{isNew ? t("newPost") : post!.title}</h1>

        {saved && <p className="pill pill-score" style={{ display: "inline-block", marginBottom: 16 }}>{t("saved")}</p>}
        {error === "title" && <p style={{ color: "var(--neg)" }}>{t("errTitle")}</p>}
        {error === "slug" && <p style={{ color: "var(--neg)" }}>{t("errSlug")}</p>}

        <form action={save} className="card">
          <input type="hidden" name="id" value={isNew ? 0 : post!.id} />

          <Field label={t("fLanguage")}>
            <select name="locale" defaultValue={post?.locale ?? routing.defaultLocale} style={input}>
              {routing.locales.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>

          <Field label={t("fTitle")}>
            <input name="title" required defaultValue={post?.title ?? ""} style={input} />
          </Field>

          <Field label={t("fSlug")} hint={t("fSlugHint")}>
            <input name="slug" defaultValue={post?.slug ?? ""} placeholder="najlepsze-gieldy-kryptowalut" style={input} />
          </Field>

          <Field label={t("fExcerpt")} hint={t("fExcerptHint")}>
            <textarea name="excerpt" rows={2} defaultValue={post?.excerpt ?? ""} style={input} />
          </Field>

          <Field label={t("fBody")} hint={t("fBodyHint")}>
            <textarea
              name="bodyMd"
              rows={20}
              defaultValue={post?.bodyMd ?? ""}
              style={{ ...input, fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 1.6 }}
            />
          </Field>

          <Field label={t("fCover")} hint={t("fCoverHint")}>
            <input name="coverUrl" type="url" defaultValue={post?.coverUrl ?? ""} style={input} />
          </Field>

          <Field label={t("fAuthor")}>
            <input name="author" defaultValue={post?.author ?? ""} style={input} />
          </Field>

          <Field label={t("fSeoTitle")} hint={t("fSeoTitleHint")}>
            <input name="seoTitle" defaultValue={post?.seoTitle ?? ""} style={input} />
          </Field>

          <Field label={t("fSeoDesc")} hint={t("fSeoDescHint")}>
            <textarea name="seoDescription" rows={2} defaultValue={post?.seoDescription ?? ""} style={input} />
          </Field>

          <Field label={t("fStatus")}>
            <select name="status" defaultValue={post?.status ?? "draft"} style={input}>
              <option value="draft">{t("statusDraft")}</option>
              <option value="published">{t("statusPublished")}</option>
            </select>
          </Field>

          <button className="btn btn-cyan" type="submit">{t("save")}</button>
        </form>

        {!isNew && (
          <form action={remove} style={{ marginTop: 16 }}>
            <input type="hidden" name="id" value={post!.id} />
            <button className="btn btn-ghost" type="submit" style={{ color: "var(--neg)" }}>{t("deletePost")}</button>
          </form>
        )}
      </div>
    </main>
  );
}
