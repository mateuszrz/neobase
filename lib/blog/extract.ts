/**
 * Extract the recent-post list from a fintech's blog/newsroom page text via
 * Claude structured outputs. Titles + optional url/date/snippet only — the
 * company's own public post metadata, not article bodies.
 */

import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "@/lib/anthropic";
import { env } from "@/lib/env";

export const BlogExtractSchema = z.object({
  posts: z.array(
    z.object({
      title: z.string(),
      url: z.string().nullable(),
      date: z.string().nullable(), // as printed on the page ("12 Jun 2026", "2026-06-12", …)
      snippet: z.string().nullable(),
    }),
  ),
});
export type ExtractedPost = z.infer<typeof BlogExtractSchema>["posts"][number];

const MAX_INPUT_CHARS = 24_000;

const SYSTEM = [
  "You extract the list of recent blog/newsroom POSTS from a fintech company's blog page text.",
  "Return each post's title exactly as shown, its link if present (absolute URL), the date as printed,",
  "and a one-line snippet if available. Only real posts on the page — never invent or summarise.",
  "Prefer the newest 6–10. Ignore nav, categories, tags, and footer links.",
].join(" ");

/** Extract posts from already-fetched blog page text. Uses Haiku (fast/cheap). */
export async function extractBlogPosts(text: string, url: string): Promise<ExtractedPost[]> {
  const clipped = text.slice(0, MAX_INPUT_CHARS);
  const res = await anthropic().messages.parse(
    {
      model: env.ANTHROPIC_REPORT_MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      output_config: { format: zodOutputFormat(BlogExtractSchema) },
      messages: [{ role: "user", content: `Blog page.\nURL: ${url}\n\nPAGE TEXT:\n${clipped}` }],
    },
    { timeout: 30_000, maxRetries: 0 },
  );
  return res.parsed_output?.posts ?? [];
}
