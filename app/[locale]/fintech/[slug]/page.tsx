import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Profile from "@/components/Profile";
import { routing } from "@/i18n/routing";
import { alternates } from "@/lib/i18n/alternates";
import { getFintech, listNeobanks } from "@/lib/queries";

export const revalidate = 3600;

export async function generateStaticParams() {
  // Tolerate a DB blip at build time: emit no params → pages render on-demand
  // (ISR) once the DB is reachable, rather than failing the whole deploy.
  try {
    const list = await listNeobanks();
    return routing.locales.flatMap((locale) => list.map((f) => ({ locale, slug: f.id })));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const ft = await getFintech(slug, locale);
  if (!ft) return { title: "Fintech not found" };
  return {
    title: `${ft.name} Review 2026 — Ratings & Reviews`,
    description: `${ft.name}${ft.country ? ` (${ft.country})` : ""} — TrustScore, reviews and sentiment. ${ft.description ?? ""}`.slice(0, 160),
    alternates: alternates(locale, `/fintech/${slug}/`),
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <Profile slug={slug} kind="neobank" />;
}
