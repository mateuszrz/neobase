/**
 * Shared brief context + a deterministic composer.
 *
 * `composeBrief` turns the context into a short factual narrative. It's used both
 * for the render-time SAMPLE preview and as the no-key fallback when generating —
 * so a brief is always grounded in real ratings/sentiment (never fabricated).
 */

export type SentimentDir = "improving" | "steady" | "softening";

export interface BriefContext {
  avgRating: number | null;
  ratingCount: number;
  platformCount: number;
  sentimentDir: SentimentDir | null;
  news: { title: string; sentiment: string }[];
}

const DIR_PHRASE: Record<SentimentDir, string> = {
  improving: "customer sentiment has been improving in recent weeks",
  steady: "customer sentiment has held broadly steady",
  softening: "customer sentiment has softened somewhat recently",
};

export function composeBrief(name: string, ctx: BriefContext): string {
  const parts: string[] = [];

  if (ctx.avgRating != null && ctx.platformCount > 0) {
    const across = ctx.platformCount > 1 ? ` across ${ctx.platformCount} platforms` : "";
    const count = ctx.ratingCount > 0 ? ` from ${new Intl.NumberFormat("en").format(ctx.ratingCount)} ratings` : "";
    parts.push(`${name} holds a cross-platform rating of ${ctx.avgRating.toFixed(1)}/5${across}${count}.`);
  } else {
    parts.push(`${name} is still building its public rating profile.`);
  }

  if (ctx.sentimentDir) parts.push(`${cap(DIR_PHRASE[ctx.sentimentDir])}.`);

  if (ctx.news.length) {
    const pos = ctx.news.filter((n) => n.sentiment === "positive").length;
    const neg = ctx.news.filter((n) => n.sentiment === "negative").length;
    const tone = neg > pos ? "leans critical" : pos > neg ? "is largely positive" : "is mixed";
    const lead = ctx.news[0]?.title;
    parts.push(`Recent media coverage ${tone}${lead ? `, led by "${trim(lead)}"` : ""}.`);
  }

  return parts.join(" ");
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const trim = (s: string) => (s.length > 90 ? s.slice(0, 87).trimEnd() + "…" : s);
