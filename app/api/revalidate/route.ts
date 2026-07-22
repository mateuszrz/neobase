import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/http";
import { revalidateArticle } from "@/lib/blog/revalidate";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/revalidate?path=/fintech/zen/&token=SECRET — purge the ISR cache for
 * one arbitrary path (a profile, directory or ranking page). Same fail-closed
 * cron-secret guard as the POST handler; cache-purge only, no content access.
 * Pass the path once per locale variant (e.g. /fintech/zen/ and /pl/fintech/zen/).
 */
export async function GET(req: Request) {
  if (!env.CRON_SECRET) return NextResponse.json({ error: "revalidation is not configured" }, { status: 503 });
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith("/")) return NextResponse.json({ error: "expected a ?path= starting with /" }, { status: 400 });
  const { revalidatePath } = await import("next/cache");
  revalidatePath(path);
  return NextResponse.json({ ok: true, revalidated: path });
}

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
 * so the cron-level secret is proportionate. Unlike the cron routes, though, it
 * refuses to serve at all when no secret is configured rather than defaulting
 * to open; see the guard below.
 *
 *   POST /api/revalidate  { "items": [{ "locale": "de", "slug": "..." }] }
 */
export async function POST(req: Request) {
  // Fail closed. `isAuthorizedCron` waves everything through when CRON_SECRET
  // is unset — a deliberate dev convenience — and CRON_SECRET turned out NOT to
  // be set in production, so inheriting that default published an open
  // cache-purge endpoint. Repeated purges would force constant regeneration of
  // 1000+ pages, so this refuses to run without a configured secret instead.
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "revalidation is not configured" }, { status: 503 });
  }
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
