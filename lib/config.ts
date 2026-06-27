/**
 * Central runtime config. Read once, here, so the rest of the app never touches
 * `process.env` directly and we have a single place to reason about secrets.
 *
 * Everything in this file is server-only EXCEPT values prefixed `NEXT_PUBLIC_`.
 */

export const config = {
  /** Aicoo REST base, e.g. https://www.aicoo.io/api/v1 */
  aicooBase: (process.env.AICOO_API_BASE || "https://www.aicoo.io/api/v1").replace(
    /\/$/,
    ""
  ),
  /** Bearer key for the host's Aicoo account. Server-only. */
  aicooKey: process.env.AICOO_API_KEY || "",
  /** Optional model override forwarded to /chat. */
  aicooModel: process.env.AICOO_MODEL || "",
  /**
   * Mock mode. True when explicitly enabled OR when no key is present — so the
   * app is always runnable, and "no key" never means "blank screen".
   */
  get mock(): boolean {
    if (process.env.FRONTDESK_MOCK === "0") return false;
    if (process.env.FRONTDESK_MOCK === "1") return true;
    return !this.aicooKey;
  },
  /**
   * Public origin for building share URLs. Prefers an explicit override, then
   * Vercel's auto-provided domain (so deploys "just work" without setting it),
   * then localhost for dev.
   */
  get appUrl(): string {
    const explicit = process.env.NEXT_PUBLIC_APP_URL;
    if (explicit) return explicit.replace(/\/$/, "");
    const vercel =
      process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
    return "http://localhost:3000";
  },
} as const;

/** True when we can actually reach Aicoo (key present and not forced to mock). */
export function liveMode(): boolean {
  return !config.mock && Boolean(config.aicooKey);
}
