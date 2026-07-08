/**
 * Resolve free-text brand / competitor inputs (e.g. "ZEN.COM", "revolut.com",
 * "Klarna") to tracked fintechs. Matching is deliberately forgiving: we compare
 * a normalised label of the input against each fintech's id (slug), name and
 * website host. Grounding the report needs a hit here — no hit means we hold no
 * data for that brand and the report says so honestly.
 */

import { db, schema } from "@/lib/db";

const { fintechs } = schema;

export interface Candidate {
  input: string; // the raw typed value
  fintechId: string | null; // matched slug, or null
  name: string; // matched fintech name, or a cleaned display of the input
}

/** Strip protocol/www/TLD/punctuation to a comparable core label. */
export function normalizeLabel(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0]; // drop any path
  s = s.replace(/\.(com|co|io|eu|net|org|app|xyz|fi|pl|de|fr|es|nl|uk|us)(\.[a-z]{2})?$/i, ""); // drop common TLDs
  s = s.replace(/[^a-z0-9]/g, ""); // collapse to alphanumerics
  return s;
}

function hostLabel(website: string | null): string | null {
  if (!website) return null;
  try {
    const host = new URL(website.includes("://") ? website : `https://${website}`).hostname;
    return normalizeLabel(host);
  } catch {
    return normalizeLabel(website);
  }
}

/**
 * Match each input against the tracked-fintech set. Returns one candidate per
 * input, in order (deduped so the brand isn't repeated among competitors).
 */
export async function matchFintechs(inputs: string[]): Promise<Candidate[]> {
  const cleaned = inputs.map((s) => s.trim()).filter(Boolean);
  if (!cleaned.length) return [];

  const rows = await db
    .select({ id: fintechs.id, name: fintechs.name, website: fintechs.website })
    .from(fintechs);

  // Build lookup from every normalised handle → fintech (id, name, website label).
  const byLabel = new Map<string, { id: string; name: string }>();
  for (const r of rows) {
    for (const label of [normalizeLabel(r.id), normalizeLabel(r.name), hostLabel(r.website)]) {
      if (label && !byLabel.has(label)) byLabel.set(label, { id: r.id, name: r.name });
    }
  }

  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const input of cleaned) {
    const label = normalizeLabel(input);
    const hit = byLabel.get(label) ?? null;
    const key = hit ? `id:${hit.id}` : `raw:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      input,
      fintechId: hit?.id ?? null,
      name: hit?.name ?? displayName(input),
    });
  }
  return out;
}

/** A tidy display name for an unmatched input ("zen.com" → "Zen.com"). */
function displayName(raw: string): string {
  const s = raw.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return s.charAt(0).toUpperCase() + s.slice(1);
}
