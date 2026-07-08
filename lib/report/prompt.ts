/**
 * The weekly competitive-intelligence prompt, adapted from the client template
 * (prompt.docx) into a system prompt + a strict JSON contract. Kept close to the
 * original eight-section structure, but bound to the data we supply: the model
 * must ground every statement in the provided ratings/sentiment/news/social and
 * must NOT invent events. Where the data is thin it says so rather than filling.
 */

import type { BrandData } from "./types";

export const REPORT_SYSTEM = `You are a competitive-intelligence analyst producing a weekly brief for a fintech / payments brand and its competitors, for an internal strategy audience.

Analysis window: the last 7 days.

You will be given structured data we already hold for the brand and each competitor: cross-platform ratings, customer-sentiment direction, and any real recent news headlines and company social posts. Some brands will have little event data (only ratings/sentiment) — that is expected.

Hard rules:
- Ground EVERY statement in the supplied data. Never invent products, partnerships, funding rounds, outages, regulatory actions, campaigns or headlines that are not in the data.
- If there is not enough data for a section, say so briefly (e.g. "No major public events detected this week") and keep it short — do not pad.
- Separate fact from interpretation. Business-relevant, concrete, no hype.
- Mark importance as high / medium / low where the schema asks for a severity.
- Write in clear business English.

The report focuses on the client brand and assesses each competitor's impact on that brand.`;

/** The JSON shape we ask Claude to return (kept in one place, echoed to the model). */
export const REPORT_JSON_CONTRACT = `Respond with ONLY a JSON object (no prose, no markdown fences) of exactly this shape:

{
  "execSummary": string[],            // 5-8 most important takeaways of the week, fact first
  "brandFocus": {
    "themes": string[],               // main themes in the brand's coverage/sentiment
    "risks": string[],                // reputational / product risks for the brand
    "opportunities": string[],        // communication / product openings
    "actions": string[]               // recommended actions for the brand
  },
  "competitorMoves": [                 // one entry per competitor with anything notable
    {
      "name": string,
      "whatHappened": string,
      "whyItMatters": string,
      "impact": string,               // implication for the brand
      "severity": "high" | "medium" | "low",
      "needsReaction": boolean
    }
  ],
  "products": [                        // products & partnerships table
    { "company": string, "item": string, "description": string, "significance": string, "reaction": string }
  ],
  "marketing": string[],              // marketing / brand / PR observations worth borrowing
  "signals": string[],                // weak strategic signals (hiring, new pages, app changes, new markets)
  "risks": [ { "text": string, "severity": "high" | "medium" | "low" } ],
  "recommendations": {
    "now": string[],                  // do now
    "watch": string[],                // observe
    "productInspiration": string[],
    "marketingInspiration": string[]
  }
}

Keep arrays tight (2-6 items each). Omit competitors/products with nothing to report rather than inventing filler.`;

/** Build the user message: the brand + competitor data context. */
export function buildUserMessage(brand: string, brands: BrandData[]): string {
  return [
    `Client brand: ${brand}`,
    `Competitors: ${brands.filter((b) => !b.isBrand).map((b) => b.name).join(", ") || "(none supplied)"}`,
    "",
    "Data we hold (real; use only this):",
    JSON.stringify(brands, null, 2),
    "",
    REPORT_JSON_CONTRACT,
  ].join("\n");
}
