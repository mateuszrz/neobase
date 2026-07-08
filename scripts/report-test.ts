/** One-off: exercise the free-report generator end-to-end. */
import "dotenv/config";
import { generateReport, getReportRequest } from "@/lib/report/generate";
import { matchFintechs } from "@/lib/report/match";

const brand = process.argv[2] ?? "ZEN.COM";
const comps = (process.argv[3] ?? "Revolut, Wise, Monzo, N26, some-random-brand.io").split(",").map((s) => s.trim());

console.log("Matching:", brand, "|", comps.join(", "));
console.log(JSON.stringify(await matchFintechs([brand, ...comps]), null, 2));

console.log("\nGenerating report…");
const { id, report } = await generateReport(brand, comps);
console.log("id:", id, "| grounded:", report.grounded, "| model note:", report.dataNote?.slice(0, 60));
console.log("execSummary:", report.execSummary);
console.log("brandFocus.rating:", report.brandFocus.rating, "sentiment:", report.brandFocus.sentimentDir);
console.log("competitorMoves:", report.competitorMoves.length, "| products:", report.products.length, "| risks:", report.risks.length);

const back = await getReportRequest(id);
console.log("\nround-trip unlocked:", back?.unlocked, "| exec bullets stored:", back?.report.execSummary.length);
process.exit(0);
