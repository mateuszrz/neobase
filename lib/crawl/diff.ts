/**
 * Structural diff of two Extracted snapshots + a human summary of the change.
 *
 * The diff is deterministic set math (added/removed/changed plans, features,
 * offers, fees). The summary is where Claude earns its place: it reads the two
 * structures and the computed delta and writes a one-liner a client would want
 * in a weekly report ("Plus went €8.99→€9.99/mo; added 'Salary advance'"). A
 * deterministic mock summary covers the offline/no-key path.
 */

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { anthropic, crawlModel, isClaudeLive } from "@/lib/anthropic";
import {
  diffIsEmpty,
  type ChangeKind,
  type ChangeSummary,
  type Extracted,
  type ExtractedDiff,
  type Fee,
  type Plan,
} from "./types";

// ─── Structural diff ────────────────────────────────────────────────────────

const planKey = (p: Plan) => p.name.trim().toLowerCase();
const feeKey = (f: Fee) => `${f.label.trim().toLowerCase()}=${f.value.trim().toLowerCase()}`;
const norm = (s: string) => s.trim().toLowerCase();

export function diffExtracted(prev: Extracted, next: Extracted): ExtractedDiff {
  const prevPlans = new Map(prev.plans.map((p) => [planKey(p), p]));
  const nextPlans = new Map(next.plans.map((p) => [planKey(p), p]));

  const addedPlans = next.plans.filter((p) => !prevPlans.has(planKey(p)));
  const removedPlans = prev.plans.filter((p) => !nextPlans.has(planKey(p)));

  // Same plan name, changed price or note.
  const changed: ExtractedDiff["changed"] = [];
  for (const [k, np] of nextPlans) {
    const pp = prevPlans.get(k);
    if (!pp) continue;
    const from = `${pp.price}${pp.priceNote ? ` (${pp.priceNote})` : ""}`;
    const to = `${np.price}${np.priceNote ? ` (${np.priceNote})` : ""}`;
    if (norm(from) !== norm(to)) changed.push({ plan: np.name, from, to });
  }

  const featSet = (e: Extracted) => new Set(e.features.map(norm));
  const offerSet = (e: Extracted) => new Set(e.offers.map(norm));
  const prevFeat = featSet(prev);
  const nextFeat = featSet(next);
  const prevOffer = offerSet(prev);
  const nextOffer = offerSet(next);

  const prevFees = new Set(prev.fees.map(feeKey));
  const nextFees = new Set(next.fees.map(feeKey));

  return {
    added: {
      plans: addedPlans,
      features: next.features.filter((f) => !prevFeat.has(norm(f))),
      offers: next.offers.filter((o) => !prevOffer.has(norm(o))),
      fees: next.fees.filter((f) => !prevFees.has(feeKey(f))),
    },
    removed: {
      plans: removedPlans,
      features: prev.features.filter((f) => !nextFeat.has(norm(f))),
      offers: prev.offers.filter((o) => !nextOffer.has(norm(o))),
      fees: prev.fees.filter((f) => !nextFees.has(feeKey(f))),
    },
    changed,
    headline:
      norm(prev.headline ?? "") !== norm(next.headline ?? "")
        ? { from: prev.headline, to: next.headline }
        : null,
  };
}

/** Which categories moved — powers filtering/badging in the report UI. */
export function changeKindsOf(d: ExtractedDiff): ChangeKind[] {
  const kinds = new Set<ChangeKind>();
  if (d.changed.length || d.added.plans.length || d.removed.plans.length || d.added.fees.length || d.removed.fees.length)
    kinds.add("price");
  if (d.added.features.length || d.removed.features.length) kinds.add("feature");
  if (d.added.offers.length || d.removed.offers.length) kinds.add("offer");
  if (d.headline) kinds.add("copy");
  return [...kinds];
}

// ─── Summary (Claude live / deterministic mock) ─────────────────────────────

const SummarySchema = z.object({ summary: z.string() });

const SUMMARY_SYSTEM = [
  "You write a single concise sentence describing how a fintech's public page changed",
  "week-over-week, for a competitive-intelligence report. Lead with the most material",
  "change (price moves, new/dropped plans, new features, new/expired offers). Be specific",
  "and factual; no fluff, no preamble. Under 40 words.",
].join(" ");

export async function summarizeChange(
  prev: Extracted,
  next: Extracted,
  diff: ExtractedDiff,
  opts?: { mock?: boolean },
): Promise<ChangeSummary> {
  const changeKinds = changeKindsOf(diff);
  const useMock = opts?.mock ?? !isClaudeLive();

  if (useMock || diffIsEmpty(diff)) {
    return { changeKinds, summary: mockSummary(diff) };
  }

  const res = await anthropic().messages.parse({
    model: crawlModel(),
    max_tokens: 512,
    system: SUMMARY_SYSTEM,
    output_config: { format: zodOutputFormat(SummarySchema), effort: "low" },
    messages: [
      {
        role: "user",
        content:
          `PREVIOUS:\n${JSON.stringify(prev)}\n\nCURRENT:\n${JSON.stringify(next)}\n\n` +
          `COMPUTED DELTA:\n${JSON.stringify(diff)}`,
      },
    ],
  });
  return { changeKinds, summary: res.parsed_output?.summary ?? mockSummary(diff) };
}

/** Deterministic, readable summary assembled straight from the structural delta. */
export function mockSummary(d: ExtractedDiff): string {
  const parts: string[] = [];
  for (const c of d.changed) parts.push(`${c.plan}: ${c.from} → ${c.to}`);
  if (d.added.plans.length) parts.push(`added plan(s): ${d.added.plans.map((p) => p.name).join(", ")}`);
  if (d.removed.plans.length) parts.push(`removed plan(s): ${d.removed.plans.map((p) => p.name).join(", ")}`);
  if (d.added.features.length) parts.push(`new feature(s): ${d.added.features.join(", ")}`);
  if (d.removed.features.length) parts.push(`dropped feature(s): ${d.removed.features.join(", ")}`);
  if (d.added.offers.length) parts.push(`new offer(s): ${d.added.offers.join(", ")}`);
  if (d.removed.offers.length) parts.push(`expired offer(s): ${d.removed.offers.join(", ")}`);
  if (d.headline) parts.push(`headline changed`);
  return parts.length ? parts.join("; ") : "No material change.";
}
