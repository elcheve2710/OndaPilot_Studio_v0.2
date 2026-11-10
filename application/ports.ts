import type { RadioData } from "@/domain/radio";

// Ports: what the application needs from the outside world. Adapters live in infrastructure/
// and are wired in server/container.ts, so moving off Cloudflare means new adapters, not new handlers.

export type CurrentUser = { userId: string; displayName: string; email: string };

export interface AuthProvider {
  currentUser(): Promise<CurrentUser | null>;
}

export interface StationRepository {
  load(userId: string): Promise<{ data: RadioData; updatedAt: string } | null>;
  /** Returns the stored updatedAt timestamp. */
  save(userId: string, data: RadioData): Promise<string>;
}

export type MediaInfo = { size: number; contentType: string };

export interface MediaStorage {
  available(): boolean;
  put(userId: string, fileId: string, file: File): Promise<void>;
  head(userId: string, fileId: string): Promise<MediaInfo | null>;
  read(userId: string, fileId: string, range?: { offset: number; length: number }): Promise<ReadableStream | null>;
  remove(userId: string, fileId: string): Promise<void>;
}

export type BroadcastStatus = {
  configured: boolean;
  connected: boolean;
  isOnline?: boolean;
  stationName?: string;
  song?: string | null;
  artist?: string | null;
  listeners?: number | null;
  streamUrl?: string | null;
  error?: string;
};

export interface BroadcastEngine {
  /** httpStatus lets the API mirror upstream failures (400 bad config, 502 unreachable). */
  status(): Promise<{ httpStatus: number; body: BroadcastStatus }>;
}
