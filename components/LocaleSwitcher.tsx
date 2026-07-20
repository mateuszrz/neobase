"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** Human names in their own language — never translated. */
const LABEL: Record<string, string> = {
  en: "English",
  pl: "Polski",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
};

/**
 * Language picker. `usePathname()` from i18n/navigation returns the path
 * WITHOUT the locale prefix, so switching keeps the reader on the same page
 * instead of dumping them on the homepage.
 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <select
      value={locale}
      onChange={(e) => router.replace(pathname, { locale: e.target.value as typeof locale })}
      aria-label="Language"
      style={{
        background: "none",
        border: "1px solid var(--stone-border)",
        borderRadius: 6,
        color: "inherit",
        font: "inherit",
        fontSize: 13,
        padding: "2px 6px",
        cursor: "pointer",
      }}
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>
          {LABEL[l] ?? l}
        </option>
      ))}
    </select>
  );
}
