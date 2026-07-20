/**
 * Editorial suppressions that sit on top of the per-field confidence gate.
 *
 * The gate in scripts/audit-confidence.ts works field by field, so a profile
 * whose individual facts each clear the bar can still add up to a misleading
 * picture. These lists are the manual override for those cases.
 */

/**
 * Profiles that render no "Company" fact block at all.
 *
 * Every id here is an exchange whose founding year we could not resolve — the
 * brand, its predecessor and its EU legal entity give different years and no
 * source settles it (see the notes in scripts/verified-facts.ts). A Company
 * block that lists a status and a headquarters but silently omits the year
 * reads as "this company has no founding date", which is worse than showing
 * nothing: it invites the reader to conclude something we don't know.
 */
export const HIDE_COMPANY_FACTS = new Set([
  "ari10",
  "bitmymoney",
  "criptan",
  "cryptonow",
  "deblock",
]);
