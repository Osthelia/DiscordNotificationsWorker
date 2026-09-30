# Osthelia Discord Notifications Worker

Cloudflare Worker shared by every service that needs to send a Discord DM
(GC Stats, Osthelia, ...). Its only job is sending the DM — it does not
check server membership itself; the caller is responsible for verifying the
recipient has joined a server the bot shares with them (Discord refuses DMs
otherwise).

## Endpoint

`POST /notify`

Headers:
- `Authorization: Bearer <service API key>`

Common fields:
- `discordId`: Discord snowflake, required.
- `service`: required, must match the name registered for the calling API key.
- `type`: `"message"` (default), `"embed"`, or `"container"`.

### `type: "message"` (default, plain content)

```json
{
  "discordId": "123456789012345678",
  "service": "gc-stats",
  "message": "Your report was resolved.",
  "images": ["https://example.com/image.png"],
  "button": { "label": "Open", "url": "https://gc-stats.example.com/..." }
}
```

- `message`: required, max 1900 characters.
- `images`: optional, up to 4 HTTPS URLs, attached as image embeds.
- `button`: optional, a single link button (label + HTTPS URL).

### `type: "embed"` (a single rich embed)

```json
{
  "discordId": "123456789012345678",
  "service": "gc-stats",
  "type": "embed",
  "embed": {
    "title": "Report resolved",
    "description": "Your report against PlayerName was resolved.",
    "color": 5763719,
    "url": "https://gc-stats.example.com/reports/42",
    "authorName": "GC Stats",
    "authorIconUrl": "https://example.com/icon.png",
    "thumbnailUrl": "https://example.com/thumb.png",
    "imageUrl": "https://example.com/image.png",
    "footerText": "GC Stats",
    "footerIconUrl": "https://example.com/footer-icon.png",
    "timestamp": "2026-09-25T12:00:00.000Z",
    "fields": [{ "name": "Status", "value": "Resolved", "inline": true }]
  },
  "button": { "label": "Open", "url": "https://gc-stats.example.com/..." }
}
```

All `embed` fields are optional but at least one must be set. Limits mirror
Discord's own: `title` 256 chars, `description` 4096 chars, `fields` up to 25
(`name` 256 chars, `value` 1024 chars), `footerText` 2048 chars, `authorName`
256 chars, `color` a `0`-`0xFFFFFF` integer, `timestamp` an ISO 8601 string.

### `type: "container"` (Components V2, fully custom layout)

```json
{
  "discordId": "123456789012345678",
  "service": "gc-stats",
  "type": "container",
  "container": {
    "accentColor": 5763719,
    "spoiler": false,
    "blocks": [
      { "kind": "text", "content": "**Report resolved**\nYour report against PlayerName was resolved." },
      { "kind": "images", "urls": ["https://example.com/image.png"] },
      { "kind": "separator", "large": false, "divider": true },
      { "kind": "buttons", "buttons": [{ "label": "Open", "url": "https://gc-stats.example.com/..." }] }
    ]
  }
}
```

`container.blocks` is an ordered list, up to 20 blocks, of:
- `{ "kind": "text", "content": string }`: max 4000 characters, supports markdown.
- `{ "kind": "images", "urls": string[] }`: 1 to 10 HTTPS URLs, rendered as a media gallery.
- `{ "kind": "separator", "large"?: boolean, "divider"?: boolean }`: visual spacing between blocks.
- `{ "kind": "buttons", "buttons": { "label": string, "url": string }[] }`: 1 to 5 link buttons.

`accentColor` (a `0`-`0xFFFFFF` integer) and `spoiler` are optional.

Response: `{ "ok": true, "channelId": "...", "messageId": "..." }` or
`{ "ok": false, "error": "..." }` (HTTP status matches). Errors:
- `dm_blocked` (422): the user has DMs closed or blocked the bot (Discord error 50007). Permanent until they change that setting, not worth retrying.
- `rate_limited` (429): Discord's own rate limit. Retried internally up to 3 times honoring `retry_after` (capped at 3s); still rate limited past that means the caller should retry the whole `/notify` call later.
- `channel_creation_failed` / `message_send_failed` (422): any other Discord API error.
- `invalid_discord_id` / `invalid_type` / `service_mismatch` (422): top level validation failed.
- `invalid_message` / `message_too_long` / `invalid_images` / `invalid_button` / `invalid_button_label` / `invalid_button_url` (422): `message` type validation failed.
- `invalid_embed` / `invalid_embed_title` / `invalid_embed_description` / `invalid_embed_url` / `invalid_embed_color` / `invalid_embed_timestamp` / `invalid_embed_author_name` / `invalid_embed_author_url` / `invalid_embed_author_icon_url` / `invalid_embed_thumbnail_url` / `invalid_embed_image_url` / `invalid_embed_footer_text` / `invalid_embed_footer_icon_url` / `invalid_embed_fields` / `invalid_embed_field` / `invalid_embed_field_name` / `invalid_embed_field_value` / `invalid_embed_field_inline` (422): `embed` type validation failed.
- `invalid_container` / `invalid_container_blocks` / `invalid_container_block` / `invalid_container_block_kind` / `invalid_container_text` / `invalid_container_images` / `invalid_container_separator` / `invalid_container_buttons` / `invalid_container_accent_color` / `invalid_container_spoiler` (422): `container` type validation failed.
- `unauthorized` (401): missing/unknown API key.

## Setup

```
npm install
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put SERVICE_KEYS   # JSON: {"gc-stats":"...","osthelia":"..."}
npm run deploy
```

For local dev, copy `.dev.vars.example` to `.dev.vars` and fill it in.

The bot must be a member of every guild its recipients are expected to be
in — sending a DM requires a mutual guild, there's no separate bot
invite flow here.
