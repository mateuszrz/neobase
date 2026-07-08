import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getAllFintechs } from "@/lib/queries";
import { activePackage, setBrands, setMarkets, EntitlementError, LimitError } from "@/lib/projects/service";
import type { Package } from "@/lib/packages";
import { PROJECT_KINDS } from "@/lib/projects/reconcile";
import { getProjectSignals } from "@/lib/projects/data";
import { CompetitorPicker } from "@/components/CompetitorPicker";
import { MarketPicker, type MarketOption } from "@/components/MarketPicker";
import { ProjectData } from "@/components/ProjectData";

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
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { saved, error } = await searchParams;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const project = await ownedProject(id, userId!);
  if (!project) notFound();

  let pkg: Package;
  try {
    pkg = await activePackage(userId!);
  } catch (e) {
    if (e instanceof EntitlementError) redirect("/panel/?error=entitlement");
    throw e;
  }

  const [brandRows, marketRows, allFintechs, signals] = await Promise.all([
    db.select({ fintechId: projectBrands.fintechId }).from(projectBrands).where(eq(projectBrands.projectId, id)),
    db.select({ country: projectMarkets.country }).from(projectMarkets).where(eq(projectMarkets.projectId, id)),
    getAllFintechs(),
    getProjectSignals(id),
  ]);
  const currentBrands = brandRows.map((r) => r.fintechId);
  const currentMarkets = marketRows.map((r) => r.country);
  const options = allFintechs.map((b) => ({ id: b.id, name: b.name, country: b.country, logoSvg: b.logoSvg }));

  async function saveBrands(formData: FormData) {
    "use server";
    const s = await auth();
    const uid = (s?.user as { id?: string } | undefined)?.id;
    if (!uid || !(await ownedProject(id, uid))) redirect("/panel/");
    const ids = formData.getAll("brandIds").map((v) => String(v));
    try {
      await setBrands(id, ids);
    } catch (e) {
      const code = e instanceof LimitError ? "limit" : e instanceof EntitlementError ? "entitlement" : "save";
      redirect(`/panel/project/${id}/?error=${code}`);
    }
    redirect(`/panel/project/${id}/?saved=brands`);
  }

  async function saveMarkets(formData: FormData) {
    "use server";
    const s = await auth();
    const uid = (s?.user as { id?: string } | undefined)?.id;
    if (!uid || !(await ownedProject(id, uid))) redirect("/panel/");
    const codes = formData.getAll("marketCodes").map((v) => String(v));
    try {
      await setMarkets(id, codes);
    } catch (e) {
      const code = e instanceof LimitError ? "limit" : e instanceof EntitlementError ? "entitlement" : "save";
      redirect(`/panel/project/${id}/?error=${code}`);
    }
    redirect(`/panel/project/${id}/?saved=markets`);
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
    redirect("/panel/");
  }

  const dailySources = currentBrands.length * currentMarkets.length * PROJECT_KINDS.length;
  const errMsg: Record<string, string> = {
    limit: `That exceeds your ${pkg.name} plan limits (${pkg.brandSlots} brands · ${pkg.marketSlots} markets).`,
    entitlement: "Your subscription is no longer active.",
    save: "Couldn't save — please try again.",
  };

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <a href="/panel/" className="nav-link" style={{ padding: 0, color: "var(--cyan-edge)", fontSize: 13 }}>← Panel</a>
        <div className="spread" style={{ alignItems: "baseline", marginTop: 10 }}>
          <h1 className="display" style={{ fontSize: "2rem" }}>{project.name}</h1>
          <span className="pill pill-score">{pkg.name}</span>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>
          {pkg.brandSlots} brand slots · {pkg.marketSlots} market slots · collected daily.
        </p>

        {saved && (
          <p className="card" style={{ marginTop: 16, padding: "10px 14px", borderLeft: "3px solid var(--cyan-signal)", fontSize: 14 }}>
            Saved {saved}. Coverage reconciled — the daily collection picks it up.
          </p>
        )}
        {error && (
          <p className="card" style={{ marginTop: 16, padding: "10px 14px", borderLeft: "3px solid var(--neg)", color: "var(--neg)", fontSize: 14 }}>
            {errMsg[error] ?? "Something went wrong."}
          </p>
        )}

        {/* Brands */}
        <form action={saveBrands} className="card stack-16" style={{ marginTop: 24, padding: 24 }}>
          <CompetitorPicker
            options={options}
            max={pkg.brandSlots}
            initial={currentBrands}
            label="Brands"
            inputName="brandIds"
            hint={`Pick up to ${pkg.brandSlots} brands to track daily across your markets.`}
          />
          <button className="btn btn-cyan" type="submit" style={{ alignSelf: "flex-start" }}>Save brands</button>
        </form>

        {/* Markets */}
        <form action={saveMarkets} className="card stack-16" style={{ marginTop: 20, padding: 24 }}>
          <MarketPicker options={MARKETS} max={pkg.marketSlots} initial={currentMarkets} />
          <button className="btn btn-cyan" type="submit" style={{ alignSelf: "flex-start" }}>Save markets</button>
        </form>

        {/* Coverage */}
        <div className="card" style={{ marginTop: 20, padding: 24 }}>
          <h2 className="subheading" style={{ marginBottom: 8 }}>Coverage</h2>
          <p className="muted" style={{ margin: 0 }}>
            {currentBrands.length} brand{currentBrands.length === 1 ? "" : "s"} × {currentMarkets.length} market
            {currentMarkets.length === 1 ? "" : "s"} → <strong style={{ color: "inherit" }}>{dailySources}</strong> daily-collected sources
            {dailySources === 0 && " (add brands and markets to start collecting)"}.
          </p>
        </div>

        {/* Intelligence — collected signals + recent changes */}
        <ProjectData signals={signals} />

        {/* Danger zone */}
        <form action={deleteProject} style={{ marginTop: 24 }}>
          <button className="btn btn-ghost" type="submit" style={{ fontSize: 13, color: "var(--neg)" }}>Delete project</button>
        </form>
      </div>
    </main>
  );
}
