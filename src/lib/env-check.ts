/** Settings sign-in can't work without. Only names are ever shown, never values. */
const REQUIRED = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ALLOWED_EMAILS"] as const;

export function missingAuthSettings(env: Record<string, string | undefined> = process.env): string[] {
  return REQUIRED.filter((name) => !env[name]?.trim());
}
