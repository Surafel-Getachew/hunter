import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, isAllowedEmail } from "@/lib/auth";

/** The session for this request, or null. Memoised per render pass. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/**
 * Use in every page and layout. Render-time checks aren't a security boundary
 * on their own; Server Actions call requireUser too.
 */
export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.user || !isAllowedEmail(session.user.email)) redirect("/login");
  return session.user;
});

export class UnauthorizedError extends Error {
  constructor() {
    super("Please sign in again.");
  }
}

/** For Server Actions and route handlers: throws instead of redirecting. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user || !isAllowedEmail(session.user.email)) throw new UnauthorizedError();
  return session.user;
}
