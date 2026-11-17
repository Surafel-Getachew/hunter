/**
 * This is a one-person app: only the Google accounts in ALLOWED_EMAILS
 * (comma-separated) can sign in. An empty list lets nobody in.
 */
export function isAllowedEmail(email: string | null | undefined, list = process.env.ALLOWED_EMAILS ?? ""): boolean {
  const allowed = list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && allowed.includes(email.trim().toLowerCase());
}
