/**
 * Auth.js (NextAuth v5) — passwordless magic-link sign-in.
 *
 * Uses the Drizzle adapter mapped onto our existing users/accounts/sessions/
 * verification_tokens tables and a database session strategy. The email is
 * delivered by our custom sender (Resend, or console in dev).
 *
 * Exports:
 *  - handlers: mounted at /api/auth/[...nextauth]
 *  - auth():   read the session in server components / route handlers / actions
 *  - signIn / signOut: server-action entry points
 */

import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, schema } from "@/lib/db";
import { sendVerificationRequest } from "./email-provider";

const magicLink = {
  id: "email",
  type: "email",
  name: "Email",
  from: process.env.EMAIL_FROM ?? "NeoBase <login@neobase.co>",
  maxAge: 24 * 60 * 60, // link valid 24h
  sendVerificationRequest,
} satisfies Provider;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  session: { strategy: "database" },
  trustHost: true, // works on Vercel + localhost without hardcoding AUTH_URL
  pages: { signIn: "/login", verifyRequest: "/login/verify" },
  providers: [magicLink],
});
