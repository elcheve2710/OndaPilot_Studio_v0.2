import type { RadioData } from "@/domain/radio";

// Browser-only fallback storage: JSON export download and audio files kept in IndexedDB.

export function exportJson(data: RadioData) {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ondapilot-programacion.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveAudio(id: string, file: File) {
  const db = await openAudioDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("files", "readwrite");
    transaction.objectStore("files").put(file, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function loadAudio(id: string): Promise<Blob | undefined> {
  const db = await openAudioDb();
  const file = await new Promise<Blob | undefined>((resolve, reject) => {
    const transaction = db.transaction("files", "readonly");
    const request = transaction.objectStore("files").get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return file;
}

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ondapilot-audio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
