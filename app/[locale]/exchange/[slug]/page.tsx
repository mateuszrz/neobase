import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Profile from "@/components/Profile";
import { routing } from "@/i18n/routing";
import { alternates } from "@/lib/i18n/alternates";
import { getFintech, listExchanges } from "@/lib/queries";

export const revalidate = 3600;

export async function generateStaticParams() {
  // Tolerate a DB blip at build time: emit no params → pages render on-demand
  // (ISR) once the DB is reachable, rather than failing the whole deploy.
  try {
    const list = await listExchanges();
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
  if (!ft) return { title: "Exchange not found" };
  // The title is the strongest on-page signal there is, so it follows the
  // reader's language — an English title over translated body copy is the
  // mismatch that keeps a localised page out of local results. `description`
  // already carries the translated prose from getFintech().
  const t = await getTranslations({ locale, namespace: "profile" });
  return {
    title: t("metaTitleExchange", { name: ft.name }),
    description: `${t("metaDescExchange", { name: ft.name })} ${ft.description ?? ""}`.slice(0, 160),
    alternates: alternates(locale, `/exchange/${slug}/`),
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <Profile slug={slug} kind="exchange" />;
}
