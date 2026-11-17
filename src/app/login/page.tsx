import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GoogleSignIn } from "@/components/google-sign-in";
import { isAllowedEmail } from "@/lib/auth";
import { getSession } from "@/lib/dal";
import { missingAuthSettings } from "@/lib/env-check";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in · Job hunt", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const missing = missingAuthSettings();
  if (missing.length) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-24">
        <h1 className="font-heading text-3xl font-semibold">Sign-in isn&apos;t set up yet</h1>
        <p className="text-sm text-muted-foreground">
          These settings are missing. Add them to <code>.env</code> locally (see <code>.env.example</code>) or to the Vercel project,
          then restart the server:
        </p>
        <ul className="list-disc pl-5 font-mono text-sm">
          {missing.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </main>
    );
  }
  const session = await getSession();
  if (session?.user && isAllowedEmail(session.user.email)) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-24">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold">Job hunt</h1>
        <p className="text-sm text-muted-foreground">A private app. Sign in with the Google account it was set up for.</p>
      </div>
      {error || (session?.user && !isAllowedEmail(session.user.email)) ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          That Google account doesn&apos;t have access.
        </p>
      ) : null}
      <GoogleSignIn />
    </main>
  );
}
