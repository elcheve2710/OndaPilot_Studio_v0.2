import { env } from "cloudflare:workers";
import type { AuthProvider, BroadcastEngine, MediaStorage, StationRepository } from "@/application/ports";
import { createAzuraCastEngine } from "@/infrastructure/azuracast/azuracast-engine";
import { getChatGPTUser } from "@/infrastructure/auth/chatgpt-auth";
import { d1StationRepository } from "@/infrastructure/cloudflare/d1-station-repository";
import { createR2MediaStorage } from "@/infrastructure/cloudflare/r2-media-storage";

export type Services = { auth: AuthProvider; stations: StationRepository; media: MediaStorage; broadcast: BroadcastEngine };

// Composition root: the only place that picks concrete adapters. A self-hosted build swaps these for
// its own (Postgres, disk/MinIO, internal auth) without touching API handlers or the domain.
export function services(): Services {
  return {
    auth: { currentUser: getChatGPTUser },
    stations: d1StationRepository,
    media: createR2MediaStorage(env.BUCKET),
    broadcast: createAzuraCastEngine({ baseUrl: env.AZURACAST_BASE_URL, stationId: env.AZURACAST_STATION_ID, apiKey: env.AZURACAST_API_KEY }),
  };
}
