import type { ButtonPayload, ContainerBlock, ContainerPayload, EmbedPayload, NotifyRequestBody, NotifyResult } from "./types";

const DISCORD_API = "https://discord.com/api/v10";
const MAX_ATTEMPTS = 3;
const MAX_RETRY_WAIT_MS = 3000;

/** Discord's DM-closed error (blocked the bot, privacy settings, or no mutual server left). */
const CANNOT_SEND_TO_USER_CODE = 50007;

/** Required on any message that sends `components` built from the Components V2 kit (containers, text displays, ...). */
const IS_COMPONENTS_V2_FLAG = 1 << 15;

interface DiscordErrorBody {
  code?: number;
  retry_after?: number;
}

interface DiscordChannel {
  id: string;
}

interface DiscordMessage {
  id: string;
}

type FetchOutcome = { ok: true; body: unknown } | { ok: false; error: "dm_blocked" | "rate_limited" | "request_failed"; status: number };

/**
 * Retries on 429 up to MAX_ATTEMPTS, waiting Discord's own `retry_after`
 * (capped at MAX_RETRY_WAIT_MS — a long backoff isn't worth holding the
 * caller's request open for, better to report rate_limited and let it retry
 * this /notify call later).
 */
async function discordFetch(url: string, init: RequestInit): Promise<FetchOutcome> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(url, init);

    if (response.ok) return { ok: true, body: await response.json() };

    if (response.status === 429) {
      const errorBody = (await response.json().catch(() => ({}))) as DiscordErrorBody;
      const retryAfterMs = (errorBody.retry_after ?? Number(response.headers.get("Retry-After") ?? 0)) * 1000;
      if (attempt < MAX_ATTEMPTS && retryAfterMs <= MAX_RETRY_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
        continue;
      }
      return { ok: false, error: "rate_limited", status: 429 };
    }

    if (response.status === 403) {
      const errorBody = (await response.json().catch(() => ({}))) as DiscordErrorBody;
      if (errorBody.code === CANNOT_SEND_TO_USER_CODE) return { ok: false, error: "dm_blocked", status: 403 };
    }

    return { ok: false, error: "request_failed", status: response.status };
  }
  return { ok: false, error: "rate_limited", status: 429 };
}

function buildButtonRow(buttons: ButtonPayload[]) {
  return { type: 1, components: buttons.map((b) => ({ type: 2, style: 5, label: b.label, url: b.url })) };
}

function buildEmbedObject(embed: EmbedPayload) {
  return {
    title: embed.title,
    description: embed.description,
    url: embed.url,
    color: embed.color,
    timestamp: embed.timestamp,
    author: embed.authorName ? { name: embed.authorName, url: embed.authorUrl, icon_url: embed.authorIconUrl } : undefined,
    thumbnail: embed.thumbnailUrl ? { url: embed.thumbnailUrl } : undefined,
    image: embed.imageUrl ? { url: embed.imageUrl } : undefined,
    footer: embed.footerText ? { text: embed.footerText, icon_url: embed.footerIconUrl } : undefined,
    fields: embed.fields?.map((f) => ({ name: f.name, value: f.value, inline: f.inline })),
  };
}

/** Maps a container block to its Components V2 component. */
function buildContainerComponent(block: ContainerBlock) {
  switch (block.kind) {
    case "text":
      return { type: 10, content: block.content };
    case "images":
      return { type: 12, items: block.urls.map((url) => ({ media: { url } })) };
    case "separator":
      return { type: 14, divider: block.divider, spacing: block.large ? 2 : 1 };
    case "buttons":
      return buildButtonRow(block.buttons);
  }
}

function buildContainerComponents(container: ContainerPayload) {
  return [
    {
      type: 17,
      accent_color: container.accentColor,
      spoiler: container.spoiler,
      components: container.blocks.map(buildContainerComponent),
    },
  ];
}

/** Builds the Discord create message payload for the request's type. */
function buildMessagePayload(body: NotifyRequestBody): Record<string, unknown> {
  if (body.type === "message") {
    const embeds = (body.images ?? []).map((url) => ({ image: { url } }));
    return {
      content: body.message,
      embeds: embeds.length ? embeds : undefined,
      components: body.button ? [buildButtonRow([body.button])] : undefined,
    };
  }

  if (body.type === "embed") {
    return {
      embeds: [buildEmbedObject(body.embed)],
      components: body.button ? [buildButtonRow([body.button])] : undefined,
    };
  }

  return { flags: IS_COMPONENTS_V2_FLAG, components: buildContainerComponents(body.container) };
}

/**
 * Sends a DM. Requires the bot to share a guild with the recipient (Discord
 * rejects DMs otherwise) — that's the "join the server" gate on the caller's side.
 */
export async function sendDiscordDm(botToken: string, body: NotifyRequestBody): Promise<NotifyResult> {
  const headers = { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" };

  const channelOutcome = await discordFetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers,
    body: JSON.stringify({ recipient_id: body.discordId }),
  });
  if (!channelOutcome.ok) {
    return { ok: false, error: channelOutcome.error === "request_failed" ? "channel_creation_failed" : channelOutcome.error };
  }
  const channel = channelOutcome.body as DiscordChannel;

  const messageOutcome = await discordFetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(buildMessagePayload(body)),
  });
  if (!messageOutcome.ok) {
    return { ok: false, error: messageOutcome.error === "request_failed" ? "message_send_failed" : messageOutcome.error };
  }
  const message = messageOutcome.body as DiscordMessage;

  return { ok: true, channelId: channel.id, messageId: message.id };
}
