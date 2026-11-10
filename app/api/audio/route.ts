import { parseRange } from "@/application/http-range";
import { services } from "@/server/container";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";
const maxBytes = 25 * 1024 * 1024;
const idPattern = /^[a-zA-Z0-9-]{10,100}$/;

async function context() {
  const { auth, media } = services();
  const user = await auth.currentUser();
  if (!user) return { error: json({ error: "authentication_required" }, 401) };
  if (!media.available()) return { error: json({ error: "media_storage_unavailable" }, 503) };
  return { user, media };
}

export async function POST(request: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { user, media } = ctx;
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: "invalid_multipart" }, 400); }
  const audio = form.get("audio");
  const fileId = form.get("id");
  if (!(audio instanceof File) || typeof fileId !== "string" || !idPattern.test(fileId)) return json({ error: "invalid_audio" }, 400);
  if (audio.size === 0 || audio.size > maxBytes) return json({ error: "file_size_exceeded", maxBytes }, 413);
  if (!audio.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(audio.name)) return json({ error: "unsupported_audio" }, 415);
  try {
    await media.put(user.userId, fileId, audio);
    return json({ ok: true, id: fileId, url: `/api/audio?id=${encodeURIComponent(fileId)}`, size: audio.size }, 201);
  } catch (failure) {
    console.error("Audio upload failed", failure);
    return json({ error: "audio_upload_failed" }, 503);
  }
}

export async function GET(request: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { user, media } = ctx;
  const fileId = new URL(request.url).searchParams.get("id");
  if (!fileId || !idPattern.test(fileId)) return json({ error: "invalid_id" }, 400);
  const info = await media.head(user.userId, fileId);
  if (!info) return json({ error: "audio_not_found" }, 404);
  const range = parseRange(request.headers.get("Range"), info.size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
  const { start, end } = range ?? { start: 0, end: info.size - 1 };
  const body = await media.read(user.userId, fileId, range ? { offset: start, length: end - start + 1 } : undefined);
  if (!body) return json({ error: "audio_not_found" }, 404);
  const headers = new Headers({
    "Content-Type": info.contentType,
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=120",
    "X-Content-Type-Options": "nosniff",
  });
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
  return new Response(body, { status: range ? 206 : 200, headers });
}

export async function DELETE(request: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { user, media } = ctx;
  const fileId = new URL(request.url).searchParams.get("id");
  if (!fileId || !idPattern.test(fileId)) return json({ error: "invalid_id" }, 400);
  await media.remove(user.userId, fileId);
  return json({ ok: true });
}
