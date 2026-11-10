import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
const maxBytes = 25 * 1024 * 1024;
const idPattern = /^[a-zA-Z0-9-]{10,100}$/;
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const storageKey = (userId: string, fileId: string) => `radio/${encodeURIComponent(userId)}/${fileId}`;

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "authentication_required" }, 401);
  if (!env.BUCKET) return json({ error: "media_storage_unavailable" }, 503);
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: "invalid_multipart" }, 400); }
  const audio = form.get("audio");
  const fileId = form.get("id");
  if (!(audio instanceof File) || typeof fileId !== "string" || !idPattern.test(fileId)) return json({ error: "invalid_audio" }, 400);
  if (audio.size === 0 || audio.size > maxBytes) return json({ error: "file_size_exceeded", maxBytes }, 413);
  if (!audio.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(audio.name)) return json({ error: "unsupported_audio" }, 415);
  try {
    await env.BUCKET.put(storageKey(user.userId, fileId), audio.stream(), { httpMetadata: { contentType: audio.type || "application/octet-stream" }, customMetadata: { filename: audio.name.slice(0, 250) } });
    return json({ ok: true, id: fileId, url: `/api/audio?id=${encodeURIComponent(fileId)}`, size: audio.size }, 201);
  } catch (error) {
    console.error("Audio upload failed", error);
    return json({ error: "audio_upload_failed" }, 503);
  }
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "authentication_required" }, 401);
  if (!env.BUCKET) return json({ error: "media_storage_unavailable" }, 503);
  const fileId = new URL(request.url).searchParams.get("id");
  if (!fileId || !idPattern.test(fileId)) return json({ error: "invalid_id" }, 400);
  const key = storageKey(user.userId, fileId);
  const head = await env.BUCKET.head(key);
  if (!head) return json({ error: "audio_not_found" }, 404);
  const range = request.headers.get("Range");
  let start = 0;
  let end = head.size - 1;
  if (range) {
    const parsed = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!parsed || (!parsed[1] && !parsed[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${head.size}` } });
    if (!parsed[1]) {
      const suffix = Number(parsed[2]);
      start = Math.max(0, head.size - suffix);
    } else {
      start = Number(parsed[1]);
      end = parsed[2] ? Math.min(head.size - 1, Number(parsed[2])) : head.size - 1;
    }
    if (start >= head.size || end < start) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${head.size}` } });
  }
  const object = await env.BUCKET.get(key, range ? { range: { offset: start, length: end - start + 1 } } : undefined);
  if (!object?.body) return json({ error: "audio_not_found" }, 404);
  const headers = new Headers({
    "Content-Type": head.httpMetadata?.contentType || "application/octet-stream",
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=120",
    "X-Content-Type-Options": "nosniff",
  });
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${head.size}`);
  return new Response(object.body, { status: range ? 206 : 200, headers });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "authentication_required" }, 401);
  if (!env.BUCKET) return json({ error: "media_storage_unavailable" }, 503);
  const fileId = new URL(request.url).searchParams.get("id");
  if (!fileId || !idPattern.test(fileId)) return json({ error: "invalid_id" }, 400);
  await env.BUCKET.delete(storageKey(user.userId, fileId));
  return json({ ok: true });
}
