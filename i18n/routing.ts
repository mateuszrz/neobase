import { defineRouting } from "next-intl/routing";

/**
 * Directory-based locales. English is the global default and stays UNPREFIXED
 * (`localePrefix: "as-needed"`), so every URL indexed before this change —
 * /exchanges/, /fintech/revolut/, /panel/ — keeps working untouched. Other
 * locales live under /pl/, /de/, … .
 *
 * A locale is a LANGUAGE, not a market. `country` already means "market" across
 * eight tables (metric_snapshots, project_markets, mentions, …) and the
 * directory filters by it via `?country=XX`. /pl/ must not silently imply
 * country=PL — a Pole comparing German neobanks is a normal case.
 */
export const routing = defineRouting({
  locales: ["en", "pl"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
