import { serve } from "@hono/node-server";
import type { Env } from "./types.js";
import { handle } from "./index.js";

const env: Env = {
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN ?? "",
  SERVICE_KEYS: process.env.SERVICE_KEYS ?? "",
};
if (!env.DISCORD_BOT_TOKEN || !env.SERVICE_KEYS) {
  console.error(JSON.stringify({ level: "fatal", msg: "DISCORD_BOT_TOKEN and SERVICE_KEYS are required" }));
  process.exit(1);
}

/** Longer than discordFetch's worst case (3 attempts x 3 s retry wait) so in-flight /notify calls finish on SIGTERM. */
const SHUTDOWN_TIMEOUT_MS = 20_000;

const server = serve({ port: Number(process.env.PORT ?? 3000), fetch: async (request) => {
  const start = performance.now();
  const response = await handle(request, env);
  const { pathname } = new URL(request.url);
  // Probes would drown the logs.
  if (pathname !== "/health" && !pathname.startsWith("/api/")) {
    console.log(JSON.stringify({ level: "info", method: request.method, path: pathname, status: response.status, ms: Math.round(performance.now() - start) }));
  }
  return response;
} }, (info) => console.log(JSON.stringify({ level: "info", msg: "listening", port: info.port })));

function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", msg: "shutting down", signal }));
  // Stops accepting, resolves once in-flight requests are done.
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
