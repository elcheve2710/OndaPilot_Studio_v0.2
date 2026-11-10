import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

// Read-only integration. Credentials stay on the server and never reach the client.
export async function GET() {
  if (!(await getChatGPTUser())) return json({ error: "authentication_required" }, 401);
  if (!env.AZURACAST_BASE_URL || !env.AZURACAST_STATION_ID) return json({ configured: false, connected: false });
  let endpoint: URL;
  try {
    const base = new URL(env.AZURACAST_BASE_URL);
    if (base.protocol !== "https:") return json({ configured: true, connected: false, error: "https_required" }, 400);
    endpoint = new URL(`/api/nowplaying/${encodeURIComponent(env.AZURACAST_STATION_ID)}`, base);
  } catch { return json({ configured: true, connected: false, error: "invalid_url" }, 400); }
  try {
    const headers = new Headers({ Accept: "application/json" });
    if (env.AZURACAST_API_KEY) headers.set("Authorization", `Bearer ${env.AZURACAST_API_KEY}`);
    const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(7000) });
    if (!response.ok) return json({ configured: true, connected: false, error: `station_http_${response.status}` }, 502);
    const data = await response.json() as Record<string, unknown>;
    const station = data.station as Record<string, unknown> | undefined;
    const nowPlaying = data.now_playing as Record<string, unknown> | undefined;
    const song = nowPlaying?.song as Record<string, unknown> | undefined;
    const mounts = Array.isArray(station?.mounts) ? station.mounts as Array<Record<string, unknown>> : [];
    const streamUrl = mounts.map((mount) => mount.url).find((url) => typeof url === "string") as string | undefined;
    return json({
      configured: true,
      connected: true,
      isOnline: Boolean(data.is_online),
      stationName: typeof station?.name === "string" ? station.name : "Emisora",
      song: typeof song?.title === "string" ? song.title : null,
      artist: typeof song?.artist === "string" ? song.artist : null,
      listeners: typeof (data.listeners as Record<string, unknown> | undefined)?.current === "number" ? (data.listeners as Record<string, number>).current : null,
      streamUrl: streamUrl?.startsWith("https://") ? streamUrl : null,
    });
  } catch (error) {
    console.error("AzuraCast status fetch failed", error);
    return json({ configured: true, connected: false, error: "station_unreachable" }, 502);
  }
}
