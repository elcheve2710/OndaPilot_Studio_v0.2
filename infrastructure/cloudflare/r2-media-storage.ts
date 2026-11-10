import type { MediaStorage } from "@/application/ports";

const storageKey = (userId: string, fileId: string) => `radio/${encodeURIComponent(userId)}/${fileId}`;

export function createR2MediaStorage(bucket: R2Bucket | undefined): MediaStorage {
  return {
    available: () => Boolean(bucket),
    async put(userId, fileId, file) {
      await bucket!.put(storageKey(userId, fileId), file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" }, customMetadata: { filename: file.name.slice(0, 250) } });
    },
    async head(userId, fileId) {
      const head = await bucket!.head(storageKey(userId, fileId));
      return head ? { size: head.size, contentType: head.httpMetadata?.contentType || "application/octet-stream" } : null;
    },
    async read(userId, fileId, range) {
      const object = await bucket!.get(storageKey(userId, fileId), range ? { range } : undefined);
      return object?.body ?? null;
    },
    async remove(userId, fileId) {
      await bucket!.delete(storageKey(userId, fileId));
    },
  };
}
