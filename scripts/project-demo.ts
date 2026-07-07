/**
 * End-to-end SaaS foundation demo (self-cleaning):
 *   npm run project:demo
 *
 * Creates a user + a Pro subscription (manual/no-Paddle-key), a project with
 * brands × markets, reconciles → shows the shared daily sources it generated, and
 * confirms the daily-project kickoff WOULD fire them (read-only, no jobs enqueued
 * against prod). Then tears everything down so prod is left clean.
 */

import "dotenv/config";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { upsertSubscription } from "../lib/paddle/index.ts";
import { createProject, setBrands, setMarkets } from "../lib/projects/service.ts";
import { reconcileProjectSources } from "../lib/projects/reconcile.ts";

const { users, sources, subscriptions } = schema;

const BRANDS = ["revolut", "n26", "monzo"];
const MARKETS = ["DE", "GB"];

const email = `demo-${Date.now()}@neobase.local`;
let userId = "";

try {
  // 1. User + Pro subscription (manual activation — no Paddle key needed).
  [{ id: userId }] = await db.insert(users).values({ email, name: "Demo" }).returning({ id: users.id });
  await upsertSubscription({ userId, packageId: "pro", status: "active" });
  console.log(`user ${email}  ·  Pro subscription active`);

  // 2. Project with brands × markets (within Pro limits: 10 brands, 5 markets).
  const projectId = await createProject(userId, "Demo project");
  await setBrands(projectId, BRANDS);
  await setMarkets(projectId, MARKETS);
  console.log(`project ${projectId}  ·  brands=[${BRANDS.join(", ")}]  markets=[${MARKETS.join(", ")}]`);

  // 3. Show the shared daily sources the reconciler generated.
  const proj = await db
    .select({ fintechId: sources.fintechId, kind: sources.kind, country: sources.country, active: sources.active })
    .from(sources)
    .where(and(eq(sources.scope, "project"), eq(sources.active, true)))
    .orderBy(sources.fintechId, sources.country, sources.kind);
  console.log(`\nGenerated ${proj.length} active project/daily sources:`);
  const byBrand = new Map<string, string[]>();
  for (const s of proj) {
    const k = `${s.fintechId} · ${s.country}`;
    (byBrand.get(k) ?? byBrand.set(k, []).get(k)!).push(s.kind);
  }
  for (const [k, kinds] of byBrand) console.log(`  ${k}: ${kinds.join(", ")}`);

  // 4. Read-only: confirm daily-project kickoff would fire exactly these.
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sources)
    .where(and(eq(sources.cadence, "daily"), eq(sources.active, true)));
  console.log(`\ndaily-project kickoff would fire: ${n} active daily sources`);
} finally {
  // 5. Teardown — remove all demo data so prod stays clean and daily stays inert.
  if (userId) {
    await db.delete(users).where(eq(users.id, userId)); // cascades project/brands/markets/subscription
  }
  await db.delete(subscriptions).where(inArray(subscriptions.userId, userId ? [userId] : ["__none__"]));
  await reconcileProjectSources(); // no entitled projects now → deactivate
  const del = await db.delete(sources).where(eq(sources.scope, "project")).returning({ id: sources.id });
  const [{ left }] = await db
    .select({ left: sql<number>`count(*)::int` })
    .from(sources)
    .where(eq(sources.cadence, "daily"));
  console.log(`\nteardown: removed ${del.length} project sources · daily sources remaining: ${left}`);
}

process.exit(0);
