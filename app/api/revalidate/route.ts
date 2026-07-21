import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/http";
import { revalidateArticle } from "@/lib/blog/revalidate";
import { routing } from "@/i18n/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Purge the ISR cache for published articles.
 *
 * `revalidatePath` only works inside a Next request scope, so a standalone
 * script (scripts/publish-article.ts) cannot call it directly — it posts here
 * instead. Without this, seeding posts straight into the database left the blog
 * index and the sitemap serving their cached copies for up to an hour, and the
 * only workaround was pushing an empty commit to force a redeploy.
 *
 * Reuses the cron guard: same shared secret, same `Authorization: Bearer` or
 * `?token=` shape. This purges caches only — it cannot read or write content —
 * so the cron-level secret is proportionate.
 *
 *   POST /api/revalidate  { "items": [{ "locale": "de", "slug": "..." }] }
 */
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "expected a non-empty items array" }, { status: 400 });
  }

  const purged: string[] = [];
  for (const item of items) {
    const { locale, slug } = (item ?? {}) as { locale?: unknown; slug?: unknown };
    if (typeof locale !== "string" || typeof slug !== "string" || !slug) {
      return NextResponse.json({ error: "each item needs a locale and a slug" }, { status: 400 });
    }
    // Guard the locale: an unknown one would build a path that revalidates
    // nothing, and report success while doing it.
    if (!(routing.locales as readonly string[]).includes(locale)) {
      return NextResponse.json({ error: `unknown locale: ${locale}` }, { status: 400 });
    }
    purged.push(...(await revalidateArticle(locale, slug)));
  }

  return NextResponse.json({ ok: true, purged: [...new Set(purged)] });
}
