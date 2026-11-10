import type { BroadcastEngine, BroadcastStatus } from "@/application/ports";

type AzuraCastConfig = { baseUrl?: string; stationId?: string; apiKey?: string };
const result = (httpStatus: number, body: BroadcastStatus) => ({ httpStatus, body });

// Read-only integration. Credentials stay on the server and never reach the client.
export function createAzuraCastEngine({ baseUrl, stationId, apiKey }: AzuraCastConfig): BroadcastEngine {
  return {
    async status() {
      if (!baseUrl || !stationId) return result(200, { configured: false, connected: false });
      let endpoint: URL;
      try {
        const base = new URL(baseUrl);
        if (base.protocol !== "https:") return result(400, { configured: true, connected: false, error: "https_required" });
        endpoint = new URL(`/api/nowplaying/${encodeURIComponent(stationId)}`, base);
      } catch { return result(400, { configured: true, connected: false, error: "invalid_url" }); }
      try {
        const headers = new Headers({ Accept: "application/json" });
        if (apiKey) headers.set("Authorization", `Bearer ${apiKey}`);
        const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(7000) });
        if (!response.ok) return result(502, { configured: true, connected: false, error: `station_http_${response.status}` });
        const data = await response.json() as Record<string, unknown>;
        const station = data.station as Record<string, unknown> | undefined;
        const nowPlaying = data.now_playing as Record<string, unknown> | undefined;
        const song = nowPlaying?.song as Record<string, unknown> | undefined;
        const mounts = Array.isArray(station?.mounts) ? station.mounts as Array<Record<string, unknown>> : [];
        const streamUrl = mounts.map((mount) => mount.url).find((url) => typeof url === "string") as string | undefined;
        const listeners = (data.listeners as Record<string, unknown> | undefined)?.current;
        return result(200, {
          configured: true,
          connected: true,
          isOnline: Boolean(data.is_online),
          stationName: typeof station?.name === "string" ? station.name : "Emisora",
          song: typeof song?.title === "string" ? song.title : null,
          artist: typeof song?.artist === "string" ? song.artist : null,
          listeners: typeof listeners === "number" ? listeners : null,
          streamUrl: streamUrl?.startsWith("https://") ? streamUrl : null,
        });
      } catch (error) {
        console.error("AzuraCast status fetch failed", error);
        return result(502, { configured: true, connected: false, error: "station_unreachable" });
      }
    },
  };
}
