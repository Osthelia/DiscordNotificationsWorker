import type { Env } from "./types.js";
import { resolveService } from "./auth.js";
import { validateNotifyBody } from "./validate.js";
import { sendDiscordDm } from "./discord.js";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Liveness and readiness are the same here: the worker holds no DB/Redis, only Discord's API as an outbound dependency.
  if (url.pathname === "/health" || url.pathname === "/api/healthz" || url.pathname === "/api/readyz") return json({ ok: true });

  if (url.pathname !== "/notify" || request.method !== "POST") {
    return json({ ok: false, error: "not_found" }, 404);
  }

  const service = resolveService(request, env);
  if (!service) return json({ ok: false, error: "unauthorized" }, 401);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const validated = validateNotifyBody(raw, service);
  if (!validated.ok) return json({ ok: false, error: validated.error }, 422);

  const result = await sendDiscordDm(env.DISCORD_BOT_TOKEN, validated.body);
  if (result.ok) return json(result, 200);
  // rate_limited is transient (retries were already exhausted above, worth
  // a fresh call later) — everything else (dm_blocked, a bad channel/message
  // request) won't change on retry.
  return json(result, result.error === "rate_limited" ? 429 : 422);
}
