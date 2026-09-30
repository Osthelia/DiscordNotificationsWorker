export interface Env {
  DISCORD_BOT_TOKEN: string;
  SERVICE_KEYS: string;
}

export interface ButtonPayload {
  label: string;
  url: string;
}

export interface EmbedFieldPayload {
  name: string;
  value: string;
  inline?: boolean;
}

export interface EmbedPayload {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  authorName?: string;
  authorUrl?: string;
  authorIconUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  footerText?: string;
  footerIconUrl?: string;
  fields?: EmbedFieldPayload[];
}

export type ContainerBlock =
  | { kind: "text"; content: string }
  | { kind: "images"; urls: string[] }
  | { kind: "separator"; large?: boolean; divider?: boolean }
  | { kind: "buttons"; buttons: ButtonPayload[] };

export interface ContainerPayload {
  accentColor?: number;
  spoiler?: boolean;
  blocks: ContainerBlock[];
}

export type NotifyRequestBody =
  | { discordId: string; service: string; type: "message"; message: string; images?: string[]; button?: ButtonPayload }
  | { discordId: string; service: string; type: "embed"; embed: EmbedPayload; button?: ButtonPayload }
  | { discordId: string; service: string; type: "container"; container: ContainerPayload };

export type NotifyResult = { ok: true; channelId: string; messageId: string } | { ok: false; error: string };
