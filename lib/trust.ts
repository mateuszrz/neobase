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
/**
 * Profiles whose MiCA register row belongs to a successor, not to the brand on
 * the page. The register entry is genuine, so we keep it — but rendered as the
 * normal green "Yes, {brand} is authorised" panel it would tell the reader the
 * opposite of the truth: that a service which has shut down is licensed and
 * free to take their money.
 *
 * `entity` is the licence holder as it appears in the register; `brand` is what
 * that entity trades as today.
 */
export const SUCCESSOR_LICENCE: Record<string, { entity: string; brand: string; note: string }> = {
  ari10: {
    entity: "WEB3 Technology B.V.",
    brand: "RGLTD",
    // Position-independent wording on purpose: this sentence is reused in the
    // generated FAQ, which can surface on its own in search results, so it
    // can't say "the licence below".
    note:
      "Ari10 stopped serving customers on 1 July 2026. The group's remaining CASP authorisation is held by its Dutch entity under a different brand, and is not a licence to use Ari10.",
  },
};

export const HIDE_COMPANY_FACTS = new Set([
  // ari10 belongs here on the founding-year rule, but is deliberately excluded:
  // its status is "ceased", and telling a reader the service has shut down
  // matters far more than the missing year misleads.
  "bitmymoney",
  "criptan",
  "cryptonow",
  "deblock",
]);
