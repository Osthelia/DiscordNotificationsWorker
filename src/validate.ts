import type { ButtonPayload, ContainerBlock, ContainerPayload, EmbedFieldPayload, EmbedPayload, NotifyRequestBody } from "./types";

const SNOWFLAKE_RE = /^\d{17,20}$/;
const MAX_MESSAGE_LENGTH = 1900;
const MAX_LABEL_LENGTH = 80;
const MAX_IMAGES = 4;

const MAX_EMBED_TITLE_LENGTH = 256;
const MAX_EMBED_DESCRIPTION_LENGTH = 4096;
const MAX_EMBED_FIELDS = 25;
const MAX_EMBED_FIELD_NAME_LENGTH = 256;
const MAX_EMBED_FIELD_VALUE_LENGTH = 1024;
const MAX_EMBED_FOOTER_LENGTH = 2048;
const MAX_EMBED_AUTHOR_NAME_LENGTH = 256;
const MAX_EMBED_COLOR = 0xffffff;

const MAX_CONTAINER_BLOCKS = 20;
const MAX_CONTAINER_TEXT_LENGTH = 4000;
const MAX_CONTAINER_IMAGES = 10;
const MAX_CONTAINER_BUTTONS = 5;

export type ValidationResult = { ok: true; body: NotifyRequestBody } | { ok: false; error: string };

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function validateButton(raw: unknown): { ok: true; button: ButtonPayload | undefined } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, button: undefined };
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "invalid_button" };
  const b = raw as Record<string, unknown>;
  if (!isNonEmptyString(b.label, MAX_LABEL_LENGTH)) return { ok: false, error: "invalid_button_label" };
  if (!isHttpsUrl(b.url)) return { ok: false, error: "invalid_button_url" };
  return { ok: true, button: { label: b.label as string, url: b.url } };
}

function validateEmbed(raw: unknown): { ok: true; embed: EmbedPayload } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "invalid_embed" };
  const e = raw as Record<string, unknown>;
  const embed: EmbedPayload = {};

  if (e.title !== undefined) {
    if (!isNonEmptyString(e.title, MAX_EMBED_TITLE_LENGTH)) return { ok: false, error: "invalid_embed_title" };
    embed.title = e.title as string;
  }
  if (e.description !== undefined) {
    if (!isNonEmptyString(e.description, MAX_EMBED_DESCRIPTION_LENGTH)) return { ok: false, error: "invalid_embed_description" };
    embed.description = e.description as string;
  }
  if (e.url !== undefined) {
    if (!isHttpsUrl(e.url)) return { ok: false, error: "invalid_embed_url" };
    embed.url = e.url as string;
  }
  if (e.color !== undefined) {
    if (typeof e.color !== "number" || !Number.isInteger(e.color) || e.color < 0 || e.color > MAX_EMBED_COLOR) {
      return { ok: false, error: "invalid_embed_color" };
    }
    embed.color = e.color;
  }
  if (e.timestamp !== undefined) {
    if (typeof e.timestamp !== "string" || Number.isNaN(Date.parse(e.timestamp))) return { ok: false, error: "invalid_embed_timestamp" };
    embed.timestamp = e.timestamp;
  }
  if (e.authorName !== undefined) {
    if (!isNonEmptyString(e.authorName, MAX_EMBED_AUTHOR_NAME_LENGTH)) return { ok: false, error: "invalid_embed_author_name" };
    embed.authorName = e.authorName as string;
  }
  if (e.authorUrl !== undefined) {
    if (!isHttpsUrl(e.authorUrl)) return { ok: false, error: "invalid_embed_author_url" };
    embed.authorUrl = e.authorUrl as string;
  }
  if (e.authorIconUrl !== undefined) {
    if (!isHttpsUrl(e.authorIconUrl)) return { ok: false, error: "invalid_embed_author_icon_url" };
    embed.authorIconUrl = e.authorIconUrl as string;
  }
  if (e.thumbnailUrl !== undefined) {
    if (!isHttpsUrl(e.thumbnailUrl)) return { ok: false, error: "invalid_embed_thumbnail_url" };
    embed.thumbnailUrl = e.thumbnailUrl as string;
  }
  if (e.imageUrl !== undefined) {
    if (!isHttpsUrl(e.imageUrl)) return { ok: false, error: "invalid_embed_image_url" };
    embed.imageUrl = e.imageUrl as string;
  }
  if (e.footerText !== undefined) {
    if (!isNonEmptyString(e.footerText, MAX_EMBED_FOOTER_LENGTH)) return { ok: false, error: "invalid_embed_footer_text" };
    embed.footerText = e.footerText as string;
  }
  if (e.footerIconUrl !== undefined) {
    if (!isHttpsUrl(e.footerIconUrl)) return { ok: false, error: "invalid_embed_footer_icon_url" };
    embed.footerIconUrl = e.footerIconUrl as string;
  }
  if (e.fields !== undefined) {
    if (!Array.isArray(e.fields) || e.fields.length > MAX_EMBED_FIELDS) return { ok: false, error: "invalid_embed_fields" };
    const fields: EmbedFieldPayload[] = [];
    for (const rawField of e.fields) {
      if (typeof rawField !== "object" || rawField === null) return { ok: false, error: "invalid_embed_field" };
      const f = rawField as Record<string, unknown>;
      if (!isNonEmptyString(f.name, MAX_EMBED_FIELD_NAME_LENGTH)) return { ok: false, error: "invalid_embed_field_name" };
      if (!isNonEmptyString(f.value, MAX_EMBED_FIELD_VALUE_LENGTH)) return { ok: false, error: "invalid_embed_field_value" };
      if (f.inline !== undefined && typeof f.inline !== "boolean") return { ok: false, error: "invalid_embed_field_inline" };
      fields.push({ name: f.name as string, value: f.value as string, inline: f.inline as boolean | undefined });
    }
    embed.fields = fields;
  }

  if (Object.keys(embed).length === 0) return { ok: false, error: "invalid_embed" };
  return { ok: true, embed };
}

function validateContainerBlock(raw: unknown): { ok: true; block: ContainerBlock } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "invalid_container_block" };
  const b = raw as Record<string, unknown>;

  if (b.kind === "text") {
    if (!isNonEmptyString(b.content, MAX_CONTAINER_TEXT_LENGTH)) return { ok: false, error: "invalid_container_text" };
    return { ok: true, block: { kind: "text", content: b.content as string } };
  }

  if (b.kind === "images") {
    if (!Array.isArray(b.urls) || b.urls.length === 0 || b.urls.length > MAX_CONTAINER_IMAGES || !b.urls.every(isHttpsUrl)) {
      return { ok: false, error: "invalid_container_images" };
    }
    return { ok: true, block: { kind: "images", urls: b.urls as string[] } };
  }

  if (b.kind === "separator") {
    if (b.large !== undefined && typeof b.large !== "boolean") return { ok: false, error: "invalid_container_separator" };
    if (b.divider !== undefined && typeof b.divider !== "boolean") return { ok: false, error: "invalid_container_separator" };
    return { ok: true, block: { kind: "separator", large: b.large as boolean | undefined, divider: b.divider as boolean | undefined } };
  }

  if (b.kind === "buttons") {
    if (!Array.isArray(b.buttons) || b.buttons.length === 0 || b.buttons.length > MAX_CONTAINER_BUTTONS) {
      return { ok: false, error: "invalid_container_buttons" };
    }
    const buttons: ButtonPayload[] = [];
    for (const rawButton of b.buttons) {
      const result = validateButton(rawButton);
      if (!result.ok) return result;
      if (!result.button) return { ok: false, error: "invalid_container_buttons" };
      buttons.push(result.button);
    }
    return { ok: true, block: { kind: "buttons", buttons } };
  }

  return { ok: false, error: "invalid_container_block_kind" };
}

function validateContainer(raw: unknown): { ok: true; container: ContainerPayload } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "invalid_container" };
  const c = raw as Record<string, unknown>;

  let accentColor: number | undefined;
  if (c.accentColor !== undefined) {
    if (typeof c.accentColor !== "number" || !Number.isInteger(c.accentColor) || c.accentColor < 0 || c.accentColor > MAX_EMBED_COLOR) {
      return { ok: false, error: "invalid_container_accent_color" };
    }
    accentColor = c.accentColor;
  }

  let spoiler: boolean | undefined;
  if (c.spoiler !== undefined) {
    if (typeof c.spoiler !== "boolean") return { ok: false, error: "invalid_container_spoiler" };
    spoiler = c.spoiler;
  }

  if (!Array.isArray(c.blocks) || c.blocks.length === 0 || c.blocks.length > MAX_CONTAINER_BLOCKS) {
    return { ok: false, error: "invalid_container_blocks" };
  }

  const blocks: ContainerBlock[] = [];
  for (const rawBlock of c.blocks) {
    const result = validateContainerBlock(rawBlock);
    if (!result.ok) return result;
    blocks.push(result.block);
  }

  return { ok: true, container: { accentColor, spoiler, blocks } };
}

/** Every field is validated server side, with a precise error identifying which one failed. */
export function validateNotifyBody(raw: unknown, expectedService: string): ValidationResult {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "invalid_body" };
  const body = raw as Record<string, unknown>;

  if (typeof body.discordId !== "string" || !SNOWFLAKE_RE.test(body.discordId)) return { ok: false, error: "invalid_discord_id" };
  if (typeof body.service !== "string" || body.service !== expectedService) return { ok: false, error: "service_mismatch" };

  const type = body.type ?? "message";

  if (type === "message") {
    if (typeof body.message !== "string" || body.message.trim().length === 0) return { ok: false, error: "invalid_message" };
    if (body.message.length > MAX_MESSAGE_LENGTH) return { ok: false, error: "message_too_long" };

    let images: string[] | undefined;
    if (body.images !== undefined) {
      if (!Array.isArray(body.images) || body.images.length > MAX_IMAGES || !body.images.every(isHttpsUrl)) {
        return { ok: false, error: "invalid_images" };
      }
      images = body.images;
    }

    const buttonResult = validateButton(body.button);
    if (!buttonResult.ok) return buttonResult;

    return {
      ok: true,
      body: { discordId: body.discordId, service: body.service, type: "message", message: body.message, images, button: buttonResult.button },
    };
  }

  if (type === "embed") {
    const embedResult = validateEmbed(body.embed);
    if (!embedResult.ok) return embedResult;

    const buttonResult = validateButton(body.button);
    if (!buttonResult.ok) return buttonResult;

    return {
      ok: true,
      body: { discordId: body.discordId, service: body.service, type: "embed", embed: embedResult.embed, button: buttonResult.button },
    };
  }

  if (type === "container") {
    const containerResult = validateContainer(body.container);
    if (!containerResult.ok) return containerResult;

    return { ok: true, body: { discordId: body.discordId, service: body.service, type: "container", container: containerResult.container } };
  }

  return { ok: false, error: "invalid_type" };
}
