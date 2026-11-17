const USER_AGENT = "job-hunt/1.0 (personal job search; github.com/surafel-getachew)";
const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": USER_AGENT, ...init.headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(res.status === 429 ? rateLimitDelay(res, attempt) : 1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    } catch (err) {
      const isHttpError = err instanceof Error && err.message.startsWith("HTTP ");
      if (isHttpError || attempt >= MAX_RETRIES) throw err;
      await sleep(1500 * (attempt + 1));
    }
  }
}

/**
 * Honors Retry-After when sent. Himalayas' Cloudflare sends none and blocks for
 * about 20 s (2026-11-17), so the fallback has to outlast that.
 */
function rateLimitDelay(res: Response, attempt: number): number {
  const seconds = Number(res.headers.get("retry-after"));
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 60) * 1000;
  return 15_000 * (attempt + 1);
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await request(url, { headers: { Accept: "application/json" } });
  return (await res.json()) as T;
}

export async function getText(url: string): Promise<string> {
  const res = await request(url);
  return res.text();
}

/** POSTs a JSON body, with the same retries as GET, and returns the raw response text. */
export async function postForText(url: string, body: unknown, headers: Record<string, string> = {}): Promise<string> {
  const res = await request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return res.text();
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json()) as T;
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.replace(/bot[^/]+/, "bot***")}: ${JSON.stringify(data)}`);
  return data;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
