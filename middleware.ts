import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  /*
   * Everything except API routes, Next internals and files with an extension.
   * `/api` in particular must never be rewritten: the cron paths are pinned in
   * vercel.json and the NextAuth handler is matched literally.
   *
   * This middleware is deliberately auth-free — it runs on the Edge, while the
   * whole auth stack is `runtime = "nodejs"`. Page-level `await auth()` guards
   * stay exactly as they are.
   */
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
