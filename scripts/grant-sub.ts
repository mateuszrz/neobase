/**
 * Grant a manual (no-Paddle) subscription to an existing user — for testing the
 * project UI before live checkout is wired.
 *
 *   npm run sub:grant -- someone@example.com pro
 *
 * The user must have logged in at least once (magic-link) so their users row
 * exists. Package: starter | growth | pro (default pro).
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { upsertSubscription } from "../lib/paddle/index.ts";
import { isPackageId } from "../lib/packages.ts";

const email = (process.argv[2] ?? "").toLowerCase();
const pkg = process.argv[3] ?? "pro";
if (!email || !isPackageId(pkg)) {
  console.error("usage: sub:grant -- <email> <starter|growth|pro>");
  process.exit(1);
}

const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
if (!u) {
  console.error(`no user for ${email} — they must magic-link login (/login) at least once first`);
  process.exit(1);
}

await upsertSubscription({ userId: u.id, packageId: pkg, status: "active" });
console.log(`granted ${pkg}/active to ${email}`);
process.exit(0);
