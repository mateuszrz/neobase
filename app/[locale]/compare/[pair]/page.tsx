import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { alternates } from "@/lib/i18n/alternates";
import { getComparison, parsePair, pairSlug, featuredPairs } from "@/lib/compare";
import Compare from "@/components/Compare";

export const revalidate = 3600;
export const dynamicParams = true; // the long tail renders on-demand (ISR)

export async function generateStaticParams() {
  // Prerender only the curated head, and only for the default locale — the rest
  // (other locales, the long tail of pairs) render on first request. Keeps this
  // off the critical path of an already-large build.
  try {
    const pairs = await featuredPairs();
    return pairs.map((p) => ({ locale: routing.defaultLocale, pair: p.pair }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; pair: string }>;
}): Promise<Metadata> {
  const { locale, pair } = await params;
  const parsed = parsePair(pair);
  if (!parsed) return { title: "Comparison not found" };
  const cmp = await getComparison(parsed[0], parsed[1], locale);
  if (!cmp) return { title: "Comparison not found" };
  const t = await getTranslations({ locale, namespace: "compare" });
  const canonical = pairSlug(cmp.a.id, cmp.b.id); // dedupe b-vs-a onto a-vs-b
  return {
    title: t("metaTitle", { a: cmp.a.name, b: cmp.b.name }),
    description: t("metaDesc", { a: cmp.a.name, b: cmp.b.name, type: cmp.type === "exchange" ? t("typeExchange") : t("typeNeobank") }),
    alternates: alternates(locale, `/compare/${canonical}/`),
  };
}

export default async function ComparePage({ params }: { params: Promise<{ locale: string; pair: string }> }) {
  const { locale, pair } = await params;
  setRequestLocale(locale);
  const parsed = parsePair(pair);
  if (!parsed) notFound();
  const cmp = await getComparison(parsed[0], parsed[1], locale);
  if (!cmp) notFound();
  return <Compare cmp={cmp} pair={pair} />;
}
