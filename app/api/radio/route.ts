import { expectedVersion } from "@/application/station-version";
import { parseRadioData } from "@/domain/schemas";
import { services } from "@/server/container";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";
const maxBytes = 1_500_000;

export async function GET() {
  const { auth, stations } = services();
  const user = await auth.currentUser();
  if (!user) return json({ error: "authentication_required" }, 401);
  try {
    const stored = await stations.load(user.userId);
    return json(stored ? { exists: true, ...stored } : { exists: false, data: null });
  } catch (error) {
    console.error("Could not read station state", error);
    return json({ error: "storage_unavailable" }, 503);
  }
}

export async function PUT(request: Request) {
  const { auth, stations } = services();
  const user = await auth.currentUser();
  if (!user) return json({ error: "authentication_required" }, 401);
  if (Number(request.headers.get("content-length") || 0) > maxBytes) return json({ error: "payload_too_large" }, 413);
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return json({ error: "payload_too_large" }, 413);
    body = JSON.parse(text);
  } catch { return json({ error: "invalid_json" }, 400); }
  const data = parseRadioData(body);
  if (!data) return json({ error: "invalid_station_data" }, 400);
  try {
    const result = await stations.save(user.userId, data, expectedVersion(request.headers));
    return result.ok ? json(result) : json({ error: "version_conflict", current: result.current }, 409);
  } catch (error) {
    console.error("Could not save station state", error);
    return json({ error: "storage_unavailable" }, 503);
  }
}
