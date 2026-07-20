import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation. Use these everywhere instead of `<a href>` and the
 * bare `next/navigation` helpers — they add the locale prefix for non-default
 * locales and leave English URLs untouched.
 *
 * `redirect` matters as much as `Link`: the panel and /test server actions
 * redirect after every submit, and the bare version would drop a Polish user
 * back onto the English page.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
