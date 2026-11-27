/**
 * Minimal stand-in so Vite can start without the platform install-page assets.
 * The kaleidoscope does not depend on the PWA tutorial chrome.
 */
export function grokPwaPlugin() {
  return {
    name: "grok-pwa-stub",
    apply: "serve",
  };
}
