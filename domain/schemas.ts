import { z } from "zod";
import type { RadioData } from "./radio.ts";

// Single validation contract for station data: used by the API and by JSON import.
// passthrough() keeps optional fields (artist, color, storage…) exactly as the client sent them.
const clock = z.string().regex(/^\d{2}:\d{2}$/);

export const radioDataSchema = z.object({
  station: z.string().max(160),
  tracks: z.array(z.object({ id: z.string(), title: z.string(), duration: z.number(), kind: z.enum(["music", "ad"]) }).passthrough()).max(5000),
  playlists: z.array(z.object({ id: z.string(), name: z.string(), trackIds: z.array(z.string()) }).passthrough()).max(500),
  blocks: z.array(z.object({ id: z.string(), day: z.number().int().min(0).max(6), start: clock, end: clock }).passthrough()).max(3000),
  campaigns: z.array(z.object({ id: z.string(), trackId: z.string(), minuteSlots: z.array(z.number()) }).passthrough()).max(500),
}).passthrough();

export function parseRadioData(value: unknown): RadioData | null {
  const result = radioDataSchema.safeParse(value);
  return result.success ? (result.data as unknown as RadioData) : null;
}
