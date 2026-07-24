/**
 * Per-project competitive-intelligence report.
 *
 * Uses the SAME 8-section structured `Report` as the public "test our reports"
 * teaser (lib/report) so the paid panel analysis matches what prospects see —
 * exec summary, brand focus, competitor moves, products/partnerships, marketing,
 * strategic signals, risks, recommendations. The project's first tracked brand
 * (by id) is treated as "the brand" (section 2); the rest are competitors.
 * Always written in English (product decision — see lib/report/generate SYSTEM).
 */

import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { buildReport } from "@/lib/report/generate";
import type { Report } from "@/lib/report/types";

const { projectBrands, projectReports, fintechs } = schema;

export type { Report } from "@/lib/report/types";

/** Generate + upsert the rich competitive report for a project. */
export async function generateProjectReport(projectId: string): Promise<Report> {
  const brandRows = await db
    .select({ id: projectBrands.fintechId, name: fintechs.name })
    .from(projectBrands)
    .innerJoin(fintechs, eq(fintechs.id, projectBrands.fintechId))
    .where(eq(projectBrands.projectId, projectId));
  // Stable order so "the brand" (section 2 focus) doesn't shuffle between runs.
  brandRows.sort((a, b) => a.id.localeCompare(b.id));

  const candidates = brandRows.map((b) => ({ input: b.name, fintechId: b.id, name: b.name }));
  const [brand, ...competitors] = candidates.length
    ? candidates
    : [{ input: "Project", fintechId: null, name: "Project" }];

  const { report, model } = await buildReport(brand, competitors, "en");

  const generatedFor = new Date().toISOString().slice(0, 10);
  await db
    .insert(projectReports)
    .values({ projectId, periodDays: report.periodDays, generatedFor, report: report as unknown as Record<string, unknown>, model })
    .onConflictDoUpdate({
      target: [projectReports.projectId, projectReports.generatedFor],
      set: { report: report as unknown as Record<string, unknown>, model, periodDays: report.periodDays, updatedAt: new Date() },
    });
  return report;
}

/** Latest stored report for a project (or null). */
export async function getProjectReport(projectId: string): Promise<{ report: Report; updatedAt: Date; model: string | null } | null> {
  const [row] = await db
    .select({ report: projectReports.report, updatedAt: projectReports.updatedAt, model: projectReports.model })
    .from(projectReports)
    .where(eq(projectReports.projectId, projectId))
    .orderBy(desc(projectReports.generatedFor))
    .limit(1);
  return row ? { report: row.report as unknown as Report, updatedAt: row.updatedAt, model: row.model } : null;
}
