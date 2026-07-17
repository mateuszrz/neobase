/**
 * Seed the MiCA/ESMA CASP registry from casp_lista_280.csv and match NeoBase's
 * tracked exchanges to it (sets fintechs.casp_provider_id).
 *
 *   npm run casp:seed
 *
 * Idempotent: upserts casp_providers on (provider, country); re-runnable.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";

const { caspProviders, fintechs } = schema;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Parse one CSV line respecting quoted fields (RFC-4180-ish). */
function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const raw = readFileSync(path.join(ROOT, "scripts", "seed-data", "casp_lista_280.csv"), "utf8").replace(/^﻿/, "");
const lines = raw.split(/\r?\n/).filter((l) => l.trim());
lines.shift(); // header

let seeded = 0;
for (const line of lines) {
  const [, provider, legalEntity, country, regulator, servicesRaw, website] = parseLine(line);
  if (!provider || !country) continue;
  const services = (servicesRaw ?? "").split(";").map((s) => s.trim()).filter(Boolean);
  await db
    .insert(caspProviders)
    .values({ provider, legalEntity: legalEntity || null, country, regulator: regulator || "—", services, website: website || null })
    .onConflictDoUpdate({
      target: [caspProviders.provider, caspProviders.country],
      set: { legalEntity: legalEntity || null, regulator: regulator || "—", services, website: website || null },
    });
  seeded++;
}
console.log(`seeded ${seeded} CASP providers`);

// ── Match tracked exchanges to the registry ──────────────────────────────────
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const domainOf = (url: string | null | undefined) =>
  (url ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
// Second-level label (TLD-agnostic): gate.io & gate.com → "gate", kucoin.eu & kucoin.com → "kucoin".
const domainRoot = (url: string | null | undefined) => {
  const p = domainOf(url).split(".");
  return p.length >= 2 ? p[p.length - 2] : p[0] ?? "";
};

const providers = await db.select().from(caspProviders);
const byName = new Map(providers.map((p) => [norm(p.provider), p]));
const byLegal = new Map(providers.filter((p) => p.legalEntity).map((p) => [norm(p.legalEntity as string), p]));
const byDomain = new Map(providers.filter((p) => p.website).map((p) => [domainOf(p.website), p]));
const byRoot = new Map(providers.filter((p) => p.website).map((p) => [domainRoot(p.website), p]));

const exch = await db.select({ id: fintechs.id, name: fintechs.name, website: fintechs.website }).from(fintechs).where(eq(fintechs.type, "exchange"));
let matched = 0;
const unmatched: string[] = [];
for (const e of exch) {
  const d = domainOf(e.website);
  const root = domainRoot(e.website);
  const hit = (d && byDomain.get(d)) || byName.get(norm(e.name)) || byLegal.get(norm(e.name)) || (root && byRoot.get(root));
  if (hit) {
    await db.update(fintechs).set({ caspProviderId: hit.id }).where(eq(fintechs.id, e.id));
    matched++;
    console.log(`  ✓ ${e.name} → ${hit.provider} (${hit.country}, ${hit.regulator})`);
  } else {
    await db.update(fintechs).set({ caspProviderId: null }).where(eq(fintechs.id, e.id));
    unmatched.push(e.name);
  }
}
console.log(`\nmatched ${matched}/${exch.length} exchanges; not in register: ${unmatched.join(", ")}`);
process.exit(0);
