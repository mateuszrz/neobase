import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
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
  // See the exchange route: the title follows the reader's language so it
  // doesn't sit in English above translated body copy. The country stays
  // outside the message — it's a code, and it only appears when we have one.
  const t = await getTranslations({ locale, namespace: "profile" });
  const name = `${ft.name}${ft.country ? ` (${ft.country})` : ""}`;
  return {
    title: t("metaTitleNeobank", { name: ft.name }),
    description: `${t("metaDescNeobank", { name })} ${ft.description ?? ""}`.slice(0, 160),
    alternates: alternates(locale, `/fintech/${slug}/`),
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <Profile slug={slug} kind="neobank" />;
}
