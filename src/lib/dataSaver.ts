/**
 * Data Saver: a lighter version of every screen for slow connections.
 *
 * - `auto` (the default) turns it on by itself when the connection is slow,
 *   and off again when it recovers.
 * - `on` / `off` are the person's own choice and always win.
 *
 * The choice and the last measured connection live in cookies, so the server
 * can render the light page from the first byte - skipping a photograph only
 * saves data if the photograph was never sent.
 */

export type SaverMode = "auto" | "on" | "off";

export const SAVER_MODE_COOKIE = "saver";
export const SAVER_NET_COOKIE = "saver-net";

const SLOW_TYPES = new Set(["slow-2g", "2g", "3g"]);

/** What Chrome reports as "effective connection type", downlink in Mbps and Save-Data. */
export function isSlow({ ect, downlink, saveData }: { ect?: string | null; downlink?: number | null; saveData?: boolean }): boolean {
  if (saveData) return true;
  if (ect && SLOW_TYPES.has(ect)) return true;
  if (typeof downlink === "number" && downlink > 0 && downlink < 1) return true;
  return false;
}

export function resolveSaver(mode: SaverMode, slow: boolean): boolean {
  return mode === "on" || (mode === "auto" && slow);
}

export function parseMode(v: string | undefined | null): SaverMode {
  return v === "on" || v === "off" ? v : "auto";
}

/**
 * The URL of a small, compressed copy of an image from Next's optimiser,
 * ignoring screen density. A phone's 3x screen would otherwise ask for an
 * image three times wider than the card showing it.
 */
export function liteImageUrl(src: string, width: 128 | 256 | 384 = 384): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=35`;
}
