/**
 * Extracts the hardcoded data arrays (vl = banks, yl = exchanges, cv = news)
 * out of the legacy minified bundle `scripts/seed-data/app.js`.
 *
 * Why not JSON.parse: the arrays are JS object literals with UNQUOTED keys and
 * embedded helper calls like `ratings:H(...)` / `sentimentHistory:W(...)`.
 * JSON.parse fails (this is exactly why the old generate.js produced nothing).
 * We instead eval the literal inside a locked-down `vm` context whose global is
 * a Proxy that reports every identifier as "defined" and returns a no-op for any
 * unknown one — so H/W and any other minified helper resolve to a harmless stub
 * while the inline data (including the `snapshots` time-series) survives intact.
 */

import fs from "node:fs";
import vm from "node:vm";

/** Slice a top-level `varName=[ ... ]` array literal by string-aware bracket matching. */
function sliceArrayLiteral(src: string, varName: string): string | null {
  const marker = `${varName}=[`;
  const at = src.indexOf(marker);
  if (at < 0) return null;
  const start = at + varName.length + 1; // index of the opening '['
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "[" || c === "{" || c === "(") depth++;
    else if (c === "]" || c === "}" || c === ")") {
      depth--;
      if (depth === 0 && c === "]") return src.slice(start, i + 1);
    }
  }
  return null;
}

function evalLiteral(literal: string): unknown {
  // A Proxy global: every identifier "exists" (has -> true) so the VM never
  // throws ReferenceError; unknown ones resolve to a no-op stub function.
  const noop = () => null;
  const base: Record<string, unknown> = { Date, Math, JSON, Array, Object, String, Number, Boolean };
  const globalProxy = new Proxy(base, {
    has: () => true,
    get: (target, prop: string) => (prop in target ? target[prop] : noop),
  });
  const context = vm.createContext(globalProxy);
  return vm.runInContext(`(${literal})`, context, { timeout: 5000 });
}

function extractArray(src: string, varName: string): Record<string, unknown>[] {
  const literal = sliceArrayLiteral(src, varName);
  if (!literal) return [];
  const value = evalLiteral(literal);
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

export interface AppJsData {
  banks: Record<string, unknown>[];
  exchanges: Record<string, unknown>[];
  news: Record<string, unknown>[];
}

export function loadAppJsData(appJsPath: string): AppJsData {
  const src = fs.readFileSync(appJsPath, "utf8");
  return {
    banks: extractArray(src, "vl"),
    exchanges: extractArray(src, "yl"),
    news: extractArray(src, "cv"),
  };
}

// ─── Field normalisers ──────────────────────────────────────────────────────

/** "8,000+" -> 8000, "1M+" -> 1000000, "" -> null */
export function parseEmployees(v: unknown): number | null {
  if (typeof v !== "string") return typeof v === "number" ? v : null;
  const m = v.replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase()] ?? 1;
  return Math.round(n * mult);
}

/** "$45B" -> 45000000000, "$1.2B" -> 1200000000, "Undisclosed" -> null */
export function parseValuation(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = v.replace(/[$,\s]/g, "").match(/([\d.]+)([KMB])?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase()] ?? 1;
  return Math.round(n * mult);
}
