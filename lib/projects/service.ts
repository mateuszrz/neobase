/**
 * Project management with package-limit enforcement.
 *
 * A user's active subscription determines their package (brand/market slots).
 * Setting brands/markets validates against those slots, then reconciles the daily
 * source set so the daily-project kickoff picks up the new coverage.
 */

import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getPackage, isEntitled, type Package } from "@/lib/packages";
import { reconcileProjectSources } from "./reconcile";

const { projects, projectBrands, projectMarkets, subscriptions, fintechs } = schema;

export class EntitlementError extends Error {}
export class LimitError extends Error {}

/** The package a user is entitled to via their most recent active/trialing sub. */
export async function activePackage(userId: string): Promise<Package> {
  const [sub] = await db
    .select({ packageId: subscriptions.packageId, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  if (!sub || !isEntitled(sub.status)) {
    throw new EntitlementError("no active subscription");
  }
  return getPackage(sub.packageId);
}

export async function createProject(userId: string, name: string): Promise<string> {
  await activePackage(userId); // must be entitled to own a project
  const [row] = await db.insert(projects).values({ userId, name }).returning({ id: projects.id });
  return row.id;
}

async function ownerOf(projectId: string): Promise<string> {
  const [p] = await db.select({ userId: projects.userId }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) throw new Error(`no such project: ${projectId}`);
  return p.userId;
}

/** Replace a project's tracked brands (validated ids, within the brand slot limit). */
export async function setBrands(projectId: string, fintechIds: string[]): Promise<void> {
  const pkg = await activePackage(await ownerOf(projectId));
  const unique = [...new Set(fintechIds)];
  if (unique.length > pkg.brandSlots) {
    throw new LimitError(`package ${pkg.id} allows ${pkg.brandSlots} brands, got ${unique.length}`);
  }
  // Reject unknown fintech ids.
  if (unique.length) {
    const known = await db.select({ id: fintechs.id }).from(fintechs).where(inArrayOrNever(fintechs.id, unique));
    const knownSet = new Set(known.map((k) => k.id));
    const bad = unique.filter((id) => !knownSet.has(id));
    if (bad.length) throw new Error(`unknown fintech(s): ${bad.join(", ")}`);
  }

  await db.delete(projectBrands).where(eq(projectBrands.projectId, projectId));
  if (unique.length) {
    await db.insert(projectBrands).values(unique.map((fintechId) => ({ projectId, fintechId })));
  }
  await reconcileProjectSources();
}

/** Replace a project's tracked markets (ISO2, within the market slot limit). */
export async function setMarkets(projectId: string, countries: string[]): Promise<void> {
  const pkg = await activePackage(await ownerOf(projectId));
  const unique = [...new Set(countries.map((c) => c.toUpperCase()))].filter((c) => c.length === 2);
  if (unique.length > pkg.marketSlots) {
    throw new LimitError(`package ${pkg.id} allows ${pkg.marketSlots} markets, got ${unique.length}`);
  }
  await db.delete(projectMarkets).where(eq(projectMarkets.projectId, projectId));
  if (unique.length) {
    await db.insert(projectMarkets).values(unique.map((country) => ({ projectId, country })));
  }
  await reconcileProjectSources();
}

// Drizzle's inArray throws on an empty array; guard so callers don't have to.
function inArrayOrNever(col: Parameters<typeof inArray>[0], values: string[]) {
  return values.length ? inArray(col, values) : sql`false`;
}
