import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { auth, signOut } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { PACKAGES, isEntitled, isPackageId } from "@/lib/packages";

export const metadata: Metadata = { title: "Panel" };

const { subscriptions, projects, projectBrands, projectMarkets } = schema;

export default async function PanelPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const [sub] = await db
    .select({ packageId: subscriptions.packageId, status: subscriptions.status, currentPeriodEnd: subscriptions.currentPeriodEnd })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);

  const entitled = sub ? isEntitled(sub.status) : false;
  const pkg = sub && isPackageId(sub.packageId) ? PACKAGES[sub.packageId] : null;

  const projs = await db
    .select({
      id: projects.id,
      name: projects.name,
      brands: sql<number>`(select count(*)::int from ${projectBrands} where ${projectBrands.projectId} = ${projects.id})`,
      markets: sql<number>`(select count(*)::int from ${projectMarkets} where ${projectMarkets.projectId} = ${projects.id})`,
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt));

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="spread" style={{ alignItems: "baseline" }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Your panel</p>
          <form action={doSignOut}>
            <button className="btn btn-ghost" type="submit" style={{ fontSize: 13 }}>Sign out</button>
          </form>
        </div>
        <h1 className="display" style={{ fontSize: "2rem" }}>{session?.user?.email}</h1>

        {/* Subscription */}
        <div className="card" style={{ marginTop: 28 }}>
          <div className="spread">
            <h2 className="subheading">Subscription</h2>
            {sub && (
              <span className={`pill ${entitled ? "pill-score" : ""}`}>{sub.status}</span>
            )}
          </div>
          {pkg ? (
            <p style={{ marginTop: 12 }} className="muted">
              <strong style={{ color: "inherit" }}>{pkg.name}</strong> — up to {pkg.brandSlots} brands · {pkg.marketSlots} markets per project.
            </p>
          ) : (
            <p style={{ marginTop: 12 }} className="muted">
              No active subscription. <a href="/monitoring" style={{ color: "var(--cyan-signal)" }}>Choose a plan</a> to start tracking brands.
            </p>
          )}
        </div>

        {/* Projects */}
        <div className="spread" style={{ marginTop: 36 }}>
          <h2 className="subheading">Projects</h2>
        </div>
        {projs.length ? (
          <div className="stack-8" style={{ marginTop: 12 }}>
            {projs.map((p) => (
              <div key={p.id} className="card row spread">
                <strong>{p.name}</strong>
                <span className="muted" style={{ fontSize: 14 }}>{p.brands} brands · {p.markets} markets</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            No projects yet. Project creation UI lands in the next slice — the data model, package limits and daily collection are already wired.
          </p>
        )}
      </div>
    </main>
  );
}
