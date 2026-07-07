/**
 * Subscription packages. Three tiers gate how many brands and markets a project
 * may track. Paddle price ids come from env (per-tier), so the same code runs
 * against sandbox or prod by swapping env — prices themselves live in Paddle.
 */

export type PackageId = "starter" | "growth" | "pro";

export interface Package {
  id: PackageId;
  name: string;
  brandSlots: number; // max brands per project
  marketSlots: number; // max markets per project
  /** Paddle price id (set via env: PADDLE_PRICE_<TIER>). Empty until wired. */
  paddlePriceId: string;
}

function priceId(tier: string): string {
  return process.env[`PADDLE_PRICE_${tier.toUpperCase()}`] ?? "";
}

export const PACKAGES: Record<PackageId, Package> = {
  starter: { id: "starter", name: "Starter", brandSlots: 3, marketSlots: 1, paddlePriceId: priceId("starter") },
  growth: { id: "growth", name: "Growth", brandSlots: 6, marketSlots: 3, paddlePriceId: priceId("growth") },
  pro: { id: "pro", name: "Pro", brandSlots: 10, marketSlots: 5, paddlePriceId: priceId("pro") },
};

export const PACKAGE_IDS = Object.keys(PACKAGES) as PackageId[];

export function isPackageId(v: string): v is PackageId {
  return v in PACKAGES;
}

export function getPackage(id: string): Package {
  const p = PACKAGES[id as PackageId];
  if (!p) throw new Error(`unknown package: ${id}`);
  return p;
}

/** Map a Paddle price id back to a package (for webhook sync). Null if unmatched. */
export function packageForPriceId(priceId: string): Package | null {
  if (!priceId) return null;
  return Object.values(PACKAGES).find((p) => p.paddlePriceId && p.paddlePriceId === priceId) ?? null;
}

/** Subscription statuses that entitle a user to collect project data. */
export const ENTITLED_STATUSES = ["active", "trialing"] as const;
export type EntitledStatus = (typeof ENTITLED_STATUSES)[number];

export function isEntitled(status: string): boolean {
  return (ENTITLED_STATUSES as readonly string[]).includes(status);
}
