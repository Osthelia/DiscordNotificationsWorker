import type { Env } from "./types";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns the calling service's name when the request's API key matches a known service, null otherwise. */
export function resolveService(request: Request, env: Env): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const key = header.slice("Bearer ".length).trim();
  if (!key) return null;

  let serviceKeys: Record<string, string>;
  try {
    serviceKeys = JSON.parse(env.SERVICE_KEYS);
  } catch {
    return null;
  }

  for (const [service, expectedKey] of Object.entries(serviceKeys)) {
    if (typeof expectedKey === "string" && timingSafeEqual(key, expectedKey)) return service;
  }
  return null;
}
