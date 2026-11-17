import { db } from "@/db";
import { FetchInProgressError, refreshJobs } from "@/lib/jobs/refresh";

// A fetch takes about a minute; give it room.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Called daily by Vercel Cron (vercel.json), which sends CRON_SECRET as a bearer token. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    return Response.json(await refreshJobs(db, { trigger: "cron" }));
  } catch (err) {
    if (err instanceof FetchInProgressError) return Response.json({ error: err.message }, { status: 409 });
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
