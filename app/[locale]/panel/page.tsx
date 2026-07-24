import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { localeRedirect as redirect } from "@/lib/i18n/redirect";
import { desc, eq, sql } from "drizzle-orm";
import { auth, signOut } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { PACKAGES, isEntitled, isPackageId } from "@/lib/packages";
import { createProject, EntitlementError } from "@/lib/projects/service";

export const metadata: Metadata = { title: "Panel" };

const { subscriptions, projects, projectBrands, projectMarkets } = schema;

export default async function PanelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("panel");
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return redirect("/login/");

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
      lastReport: sql<string | null>`(select max(generated_for)::text from project_reports r where r.project_id = "projects"."id")`,
      lastData: sql<string | null>`(select max(si.week)::text from sentiment_index si join project_brands pb on pb.fintech_id = si.fintech_id where pb.project_id = "projects"."id")`,
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt));

  const shortDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short" }) : null);

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  async function newProject(formData: FormData) {
    "use server";
    const s = await auth();
    const uid = (s?.user as { id?: string } | undefined)?.id;
    if (!uid) return redirect("/login/");
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return redirect("/panel/");
    let id: string;
    try {
      id = await createProject(uid!, name);
    } catch (e) {
      if (e instanceof EntitlementError) return redirect("/panel/?error=entitlement");
      throw e;
    }
    return redirect(`/panel/project/${id}/`);
  }

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="spread" style={{ alignItems: "baseline" }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>{t("yourPanel")}</p>
          <form action={doSignOut}>
            <button className="btn btn-ghost" type="submit" style={{ fontSize: 13 }}>{t("signOut")}</button>
          </form>
        </div>
        <h1 className="display" style={{ fontSize: "2rem" }}>{session?.user?.email}</h1>

        {/* Subscription */}
        <div className="card" style={{ marginTop: 28 }}>
          <div className="spread">
            <h2 className="subheading">{t("subscription")}</h2>
            {sub && (
              <span className={`pill ${entitled ? "pill-score" : ""}`}>{sub.status}</span>
            )}
          </div>
          {pkg ? (
            <p style={{ marginTop: 12 }} className="muted">
              <strong style={{ color: "inherit" }}>{pkg.name}</strong> - {t("pkgLine", { brands: pkg.brandSlots, markets: pkg.marketSlots })}
            </p>
          ) : (
            <p style={{ marginTop: 12 }} className="muted">
              {t.rich("noSub", { link: (c) => <Link href="/monitoring/" style={{ color: "var(--cyan-signal)" }}>{c}</Link> })}
            </p>
          )}
        </div>

        {/* Projects */}
        <div className="spread" style={{ marginTop: 36 }}>
          <h2 className="subheading">{t("projects")}</h2>
        </div>

        {projs.length > 0 && (
          <div className="stack-8" style={{ marginTop: 12 }}>
            {projs.map((p) => (
              <Link key={p.id} href={`/panel/project/${p.id}/`} className="card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <div className="spread" style={{ alignItems: "baseline" }}>
                  <strong>{p.name}</strong>
                  <span className="muted" style={{ fontSize: 14 }}>{t("projectMeta", { brands: p.brands, markets: p.markets })}</span>
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <span>{p.lastReport ? t("dashReportOn", { date: shortDate(p.lastReport)! }) : t("dashNoReport")}</span>
                  {p.lastData && <span>{t("dashDataOn", { date: shortDate(p.lastData)! })}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {entitled ? (
          <form action={newProject} className="card row" style={{ marginTop: 16, gap: 8 }}>
            <input
              name="name"
              required
              placeholder={t("newProjectPlaceholder")}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--stone-border)", fontSize: 15 }}
            />
            <button className="btn btn-cyan" type="submit">{t("createProject")}</button>
          </form>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            {t.rich("needSub", { link: (c) => <Link href="/monitoring/" style={{ color: "var(--cyan-signal)" }}>{c}</Link> })}
          </p>
        )}
      </div>
    </main>
  );
}
