/**
 * Shared live-preview OAuth client. Server-only — do not import from the browser.
 * Deployed apps override these with injected GROK_AUTH_* values.
 */
export const PREVIEW_CLIENT_ID = "grok_preview";
export const PREVIEW_CLIENT_SECRET = "";

export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";

export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
