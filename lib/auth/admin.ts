import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

/**
 * Author gate for the blog editor.
 *
 * /panel is where paying customers manage their projects, so the usual
 * "is there a session?" check would let any subscriber publish to the public
 * site. Authoring is gated on an explicit email allowlist instead.
 *
 * An env var rather than a `users.role` column on purpose: it needs no
 * migration, and it cannot be escalated from inside the app — nothing in the
 * request path can write to it.
 */
function allowlist(): string[] {
  return env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(): Promise<boolean> {
  const emails = allowlist();
  if (emails.length === 0) return false; // unset means nobody, never everybody
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  return !!email && emails.includes(email);
}

/**
 * Throws unless the caller is an allowlisted author.
 *
 * Call this in every server action too, not just the page that renders the
 * form: a server action is its own POST endpoint and can be invoked directly,
 * so guarding only the page leaves the mutation wide open.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Not authorised");
}
