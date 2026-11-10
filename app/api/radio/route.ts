import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { radioStates } from "../../../db/schema";
import type { RadioData } from "../../../lib/radio";

export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

function validData(value: unknown): value is RadioData {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (typeof data.station !== "string" || data.station.length > 160) return false;
  if (!Array.isArray(data.tracks) || data.tracks.length > 5000) return false;
  if (!Array.isArray(data.playlists) || data.playlists.length > 500) return false;
  if (!Array.isArray(data.blocks) || data.blocks.length > 3000) return false;
  if (!Array.isArray(data.campaigns) || data.campaigns.length > 500) return false;
  return data.tracks.every((x) => x && typeof x.id === "string" && typeof x.title === "string" && typeof x.duration === "number" && (x.kind === "music" || x.kind === "ad"))
    && data.playlists.every((x) => x && typeof x.id === "string" && typeof x.name === "string" && Array.isArray(x.trackIds))
    && data.blocks.every((x) => x && typeof x.id === "string" && Number.isInteger(x.day) && x.day >= 0 && x.day < 7 && /^\d{2}:\d{2}$/.test(x.start) && /^\d{2}:\d{2}$/.test(x.end))
    && data.campaigns.every((x) => x && typeof x.id === "string" && typeof x.trackId === "string" && Array.isArray(x.minuteSlots));
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "authentication_required" }, 401);
  try {
    const [row] = await getDb().select().from(radioStates).where(eq(radioStates.userId, user.userId)).limit(1);
    return json(row ? { exists: true, data: JSON.parse(row.dataJson), updatedAt: row.updatedAt } : { exists: false, data: null });
  } catch (error) {
    console.error("Could not read station state", error);
    return json({ error: "storage_unavailable" }, 503);
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "authentication_required" }, 401);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 1_500_000) return json({ error: "payload_too_large" }, 413);
  let data: unknown;
  try {
    const body = await request.text();
    if (body.length > 1_500_000) return json({ error: "payload_too_large" }, 413);
    data = JSON.parse(body);
  } catch { return json({ error: "invalid_json" }, 400); }
  if (!validData(data)) return json({ error: "invalid_station_data" }, 400);
  const updatedAt = new Date().toISOString();
  try {
    await getDb().insert(radioStates).values({ userId: user.userId, dataJson: JSON.stringify(data), updatedAt })
      .onConflictDoUpdate({ target: radioStates.userId, set: { dataJson: JSON.stringify(data), updatedAt } });
    return json({ ok: true, updatedAt });
  } catch (error) {
    console.error("Could not save station state", error);
    return json({ error: "storage_unavailable" }, 503);
  }
}
