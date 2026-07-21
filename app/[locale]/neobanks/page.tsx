import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listNeobanks } from "@/lib/queries";
import { alternates } from "@/lib/i18n/alternates";
import { FintechCard } from "@/components/ui";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "directory" });
  return {
    title: t("neobanksMetaTitle"),
    description: t("neobanksMetaDesc"),
    alternates: alternates(locale, "/neobanks/"),
  };
}

export default async function NeobanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ country?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { country } = await searchParams;
  const t = await getTranslations("directory");
  const all = await listNeobanks();
  const countries = [...new Set(all.map((f) => f.country).filter(Boolean))].sort() as string[];
  const list = country ? all.filter((f) => f.country === country) : all;

  return (
    <main className="section">
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 12 }}>{t("eyebrow")}</p>
        <h1 className="h-sm">{t("neobanksTitle")}</h1>
        <p className="lead" style={{ marginTop: 10, marginBottom: 24 }}>
          {/* ICU plurals, not a ternary: Polish needs three forms (1 firma,
              2 firmy, 5 firm) where English needs two. */}
          {country
            ? t("countInCountry", { count: list.length, country })
            : t("countWorldwide", { count: list.length })}
        </p>

        <div className="row" style={{ gap: 8, marginBottom: 28 }}>
          <Link className={`badge${!country ? " pill-score" : ""}`} href="/neobanks/">{t("all")}</Link>
          {countries.map((c) => (
            <Link key={c} className={`badge${country === c ? " pill-score" : ""}`} href={`/neobanks/?country=${c}`}>
              {c}
            </Link>
          ))}
        </div>

        <div className="grid grid-3">
          {list.map((f) => (
            <FintechCard key={f.id} f={f} kind="neobank" />
          ))}
        </div>
      </div>
    </main>
  );
}
