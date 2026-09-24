import { cookies, headers } from "next/headers";
import { isSlow, parseMode, resolveSaver, SAVER_MODE_COOKIE, SAVER_NET_COOKIE, type SaverMode } from "@/lib/dataSaver";

/**
 * The server's view of Data Saver for this request: the person's choice, and
 * whether the connection looks slow - from Chrome's client hints (Save-Data,
 * ECT, Downlink) or from what the page itself last measured.
 */
export async function getInitialSaver(): Promise<{ mode: SaverMode; slow: boolean; on: boolean }> {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const mode = parseMode(jar.get(SAVER_MODE_COOKIE)?.value);
  const downlink = Number(h.get("downlink"));
  const slow =
    jar.get(SAVER_NET_COOKIE)?.value === "slow" ||
    isSlow({
      saveData: h.get("save-data")?.toLowerCase() === "on",
      ect: h.get("ect"),
      downlink: Number.isFinite(downlink) ? downlink : null,
    });
  return { mode, slow, on: resolveSaver(mode, slow) };
}
