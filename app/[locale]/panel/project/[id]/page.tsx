import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { localeRedirect as redirect } from "@/lib/i18n/redirect";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getAllFintechs } from "@/lib/queries";
import { activePackage, setBrands, setMarkets, EntitlementError, LimitError } from "@/lib/projects/service";
import type { Package } from "@/lib/packages";
import { PROJECT_KINDS } from "@/lib/projects/reconcile";
import { getProjectSignals, getProjectTrend } from "@/lib/projects/data";
import { generateProjectReport, getProjectReport } from "@/lib/projects/report";
import { CompetitorPicker } from "@/components/CompetitorPicker";
import { MarketPicker, type MarketOption } from "@/components/MarketPicker";
import { ProjectData } from "@/components/ProjectData";
import { ProjectTrend } from "@/components/ProjectTrend";
import { ProjectReportView } from "@/components/ProjectReport";

export const metadata: Metadata = { title: "Project", robots: { index: false } };

const { projects, projectBrands, projectMarkets } = schema;

// Markets we can collect (ISO2). Slots are ≤5, so a curated set is plenty.
const MARKETS: MarketOption[] = [
  { code: "GB", name: "United Kingdom" }, { code: "US", name: "United States" }, { code: "DE", name: "Germany" },
  { code: "FR", name: "France" }, { code: "ES", name: "Spain" }, { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" }, { code: "IE", name: "Ireland" }, { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" }, { code: "BE", name: "Belgium" }, { code: "AT", name: "Austria" },
  { code: "SE", name: "Sweden" }, { code: "DK", name: "Denmark" }, { code: "NO", name: "Norway" },
  { code: "FI", name: "Finland" }, { code: "CH", name: "Switzerland" }, { code: "RO", name: "Romania" },
  { code: "LT", name: "Lithuania" }, { code: "AU", name: "Australia" }, { code: "CA", name: "Canada" },
  { code: "SG", name: "Singapore" }, { code: "BR", name: "Brazil" }, { code: "IN", name: "India" },
];

async function ownedProject(id: string, userId: string) {
  const [p] = await db.select({ id: projects.id, name: projects.name, userId: projects.userId }).from(projects).where(eq(projects.id, id)).limit(1);
  if (!p || p.userId !== userId) return null;
  return p;
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("panel");
  const { saved, error } = await searchParams;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return redirect("/login/");

  const project = await ownedProject(id, userId!);
  if (!project) notFound();

  let pkg: Package;
  try {
    pkg = await activePackage(userId!);
  } catch (e) {
    if (e instanceof EntitlementError) return redirect("/panel/?error=entitlement");
    throw e;
  }

  const [brandRows, marketRows, allFintechs, signals, trends, storedReport] = await Promise.all([
    db.select({ fintechId: projectBrands.fintechId }).from(projectBrands).where(eq(projectBrands.projectId, id)),
    db.select({ country: projectMarkets.country }).from(projectMarkets).where(eq(projectMarkets.projectId, id)),
    getAllFintechs(),
    getProjectSignals(id),
    getProjectTrend(id),
    getProjectReport(id),
  ]);
  const currentBrands = brandRows.map((r) => r.fintechId);
  const currentMarkets = marketRows.map((r) => r.country);
  const options = allFintechs.map((b) => ({ id: b.id, name: b.name, country: b.country, logoSvg: b.logoSvg }));

  async function saveBrands(formData: FormData) {
    "use server";
    const s = await auth();
    const uid = (s?.user as { id?: string } | undefined)?.id;
    if (!uid || !(await ownedProject(id, uid))) return redirect("/panel/");
    const ids = formData.getAll("brandIds").map((v) => String(v));
    try {
      await setBrands(id, ids);
    } catch (e) {
      const code = e instanceof LimitError ? "limit" : e instanceof EntitlementError ? "entitlement" : "save";
      return redirect(`/panel/project/${id}/?error=${code}`);
    }
    return redirect(`/panel/project/${id}/?saved=brands`);
  }

  async function saveMarkets(formData: FormData) {
    "use server";
    const s = await auth();
    const uid = (s?.user as { id?: string } | undefined)?.id;
    if (!uid || !(await ownedProject(id, uid))) return redirect("/panel/");
    const codes = formData.getAll("marketCodes").map((v) => String(v));
    try {
      await setMarkets(id, codes);
    } catch (e) {
      const code = e instanceof LimitError ? "limit" : e instanceof EntitlementError ? "entitlement" : "save";
      return redirect(`/panel/project/${id}/?error=${code}`);
    }
    return redirect(`/panel/project/${id}/?saved=markets`);
  }

  async function genReport() {
    "use server";
    const s = await auth();
    const uid = (s?.user as { id?: string } | undefined)?.id;
    if (!uid || !(await ownedProject(id, uid))) return redirect("/panel/");
    await generateProjectReport(id);
    return redirect(`/panel/project/${id}/?saved=report`);
  }

  async function deleteProject() {
    "use server";
    const s = await auth();
    const uid = (s?.user as { id?: string } | undefined)?.id;
    if (uid && (await ownedProject(id, uid))) {
      await db.delete(projects).where(eq(projects.id, id)); // cascades brands/markets
      const { reconcileProjectSources } = await import("@/lib/projects/reconcile");
      await reconcileProjectSources();
    }
    return redirect("/panel/");
  }

  const dailySources = currentBrands.length * currentMarkets.length * PROJECT_KINDS.length;
  const errMsg: Record<string, string> = {
    limit: t("errLimit", { plan: pkg.name, brands: pkg.brandSlots, markets: pkg.marketSlots }),
    entitlement: t("errEntitlement"),
    save: t("errSave"),
  };

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <Link href="/panel/" className="nav-link" style={{ padding: 0, color: "var(--cyan-edge)", fontSize: 13 }}>{t("backPanel")}</Link>
        <div className="spread" style={{ alignItems: "baseline", marginTop: 10 }}>
          <h1 className="display" style={{ fontSize: "2rem" }}>{project.name}</h1>
          <span className="pill pill-score">{pkg.name}</span>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>
          {t("prjSlots", { brands: pkg.brandSlots, markets: pkg.marketSlots })}
        </p>

        {saved && (
          <p className="card" style={{ marginTop: 16, padding: "10px 14px", borderLeft: "3px solid var(--cyan-signal)", fontSize: 14 }}>
            {t("prjSaved")}
          </p>
        )}
        {error && (
          <p className="card" style={{ marginTop: 16, padding: "10px 14px", borderLeft: "3px solid var(--neg)", color: "var(--neg)", fontSize: 14 }}>
            {errMsg[error] ?? t("prjError")}
          </p>
        )}

        {/* Brands */}
        <form action={saveBrands} className="card stack-16" style={{ marginTop: 24, padding: 24 }}>
          <CompetitorPicker
            options={options}
            max={pkg.brandSlots}
            initial={currentBrands}
            label={t("prjBrands")}
            inputName="brandIds"
            hint={t("prjBrandsHint", { max: pkg.brandSlots })}
          />
          <button className="btn btn-cyan" type="submit" style={{ alignSelf: "flex-start" }}>{t("prjSaveBrands")}</button>
        </form>

        {/* Markets */}
        <form action={saveMarkets} className="card stack-16" style={{ marginTop: 20, padding: 24 }}>
          <MarketPicker options={MARKETS} max={pkg.marketSlots} initial={currentMarkets} />
          <button className="btn btn-cyan" type="submit" style={{ alignSelf: "flex-start" }}>{t("prjSaveMarkets")}</button>
        </form>

        {/* Coverage */}
        <div className="card" style={{ marginTop: 20, padding: 24 }}>
          <h2 className="subheading" style={{ marginBottom: 8 }}>{t("prjCoverage")}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t(dailySources === 0 ? "prjCoverageEmpty" : "prjCoverageLine", { brands: currentBrands.length, markets: currentMarkets.length, sources: dailySources })}
          </p>
        </div>

        {/* Intelligence — collected signals + recent changes */}
        <ProjectData signals={signals} />

        {/* Sentiment trend — per-brand composite over the last weeks (sparklines) */}
        <ProjectTrend trends={trends} />

        {/* Monthly report — Claude digest over the collected data */}
        <ProjectReportView
          report={storedReport?.report ?? null}
          updatedAt={storedReport?.updatedAt ?? null}
          model={storedReport?.model ?? null}
          generate={genReport}
        />

        {/* Danger zone */}
        <form action={deleteProject} style={{ marginTop: 24 }}>
          <button className="btn btn-ghost" type="submit" style={{ fontSize: 13, color: "var(--neg)" }}>{t("deleteProject")}</button>
        </form>
      </div>
    </main>
  );
}
