export type Track = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: number;
  kind: "music" | "ad";
  uploaded?: boolean;
  fileName?: string;
  storage?: "cloud" | "local";
};

export type Playlist = {
  id: string;
  name: string;
  description: string;
  color: string;
  trackIds: string[];
  shuffle: boolean;
};

export type RadioBlock = {
  id: string;
  title: string;
  day: number;
  start: string;
  end: string;
  playlistId: string;
};

export type Campaign = {
  id: string;
  brand: string;
  title: string;
  trackId: string;
  minuteSlots: number[];
  enabled: boolean;
};

export type RadioData = {
  tracks: Track[];
  playlists: Playlist[];
  blocks: RadioBlock[];
  campaigns: Campaign[];
  station: string;
};

export const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const COLORS = ["#33d6bb", "#b38aff", "#ffad72", "#62a6ff", "#f9779e", "#e9c46a"];
export const id = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export const seedData: RadioData = {
  station: "Mi emisora online",
  tracks: [
    { id: "t1", title: "Horizonte de verano", artist: "Audio de ejemplo", genre: "Pop latino", duration: 218, kind: "music" },
    { id: "t2", title: "Ritmo de la ciudad", artist: "Audio de ejemplo", genre: "Urbano", duration: 194, kind: "music" },
    { id: "t3", title: "Café de la mañana", artist: "Audio de ejemplo", genre: "Acústico", duration: 245, kind: "music" },
    { id: "t4", title: "Sabor de mi tierra", artist: "Audio de ejemplo", genre: "Tropical", duration: 226, kind: "music" },
    { id: "t5", title: "Luz de medianoche", artist: "Audio de ejemplo", genre: "Electrónica", duration: 208, kind: "music" },
    { id: "t6", title: "Brisa en el mar", artist: "Audio de ejemplo", genre: "Pop latino", duration: 232, kind: "music" },
    { id: "t7", title: "Frecuencia abierta", artist: "Audio de ejemplo", genre: "Indie", duration: 201, kind: "music" },
    { id: "t8", title: "Atardecer tropical", artist: "Audio de ejemplo", genre: "Tropical", duration: 252, kind: "music" },
    { id: "ad1", title: "Promoción local · 30 s", artist: "Anunciante de ejemplo", genre: "Publicidad", duration: 30, kind: "ad" },
    { id: "ad2", title: "Identificación de emisora · 15 s", artist: "Mi emisora", genre: "Publicidad", duration: 15, kind: "ad" },
  ],
  playlists: [
    { id: "p1", name: "Mañanas con energía", description: "Para comenzar el día con buen ritmo", color: "#33d6bb", trackIds: ["t3", "t1", "t7", "t6"], shuffle: false },
    { id: "p2", name: "Pop & tendencias", description: "Una selección para toda la tarde", color: "#b38aff", trackIds: ["t1", "t2", "t6", "t5"], shuffle: true },
    { id: "p3", name: "Tropical en vivo", description: "Sabor y movimiento", color: "#ffad72", trackIds: ["t4", "t8", "t2"], shuffle: false },
    { id: "p4", name: "Rotación nocturna", description: "Música continua de respaldo", color: "#62a6ff", trackIds: ["t5", "t7", "t6", "t1"], shuffle: true },
  ],
  blocks: [
    ...[0, 1, 2, 3, 4].flatMap((day) => [
      { id: `am-${day}`, title: "Despierta con música", day, start: "06:00", end: "10:00", playlistId: "p1" },
      { id: `pm-${day}`, title: "Tardes en frecuencia", day, start: "12:00", end: "16:00", playlistId: "p2" },
      { id: `night-${day}`, title: "Tropical al anochecer", day, start: "18:00", end: "22:00", playlistId: "p3" },
    ]),
    ...[5, 6].flatMap((day) => [
      { id: `weekend-${day}`, title: "Fin de semana musical", day, start: "09:00", end: "15:00", playlistId: "p2" },
      { id: `weekend-night-${day}`, title: "Especial tropical", day, start: "17:00", end: "23:00", playlistId: "p3" },
    ]),
  ],
  campaigns: [
    { id: "a1", brand: "Comercio local", title: "Pauta de mediodía", trackId: "ad1", minuteSlots: [15, 45], enabled: true },
    { id: "a2", brand: "Identidad de estación", title: "Identificación horaria", trackId: "ad2", minuteSlots: [0], enabled: true },
  ],
};

export function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function fmtSeconds(duration: number) {
  return `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`;
}

export function formatTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return `${(hour % 12) || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "p. m." : "a. m."}`;
}

export function dayIndex(date: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Bogota" }).format(date);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
}

function colombiaTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

export function blockDuration(block: RadioBlock) {
  const delta = minutes(block.end) - minutes(block.start);
  return delta > 0 ? delta : delta + 1440;
}

// Divide overnight blocks and the Sunday-to-Monday boundary into comparable intervals.
export function blockIntervals(block: RadioBlock): [number, number][] {
  const from = block.day * 1440 + minutes(block.start);
  const to = from + blockDuration(block);
  const week = 10080;
  return to > week ? [[from, week], [0, to - week]] : [[from, to]];
}

export function conflicts(block: RadioBlock, existing: RadioBlock[], ignoreId?: string) {
  const wanted = blockIntervals(block);
  return existing.filter((other) => other.id !== ignoreId && blockIntervals(other).some(([c, d]) => wanted.some(([a, b]) => a < d && c < b)));
}

export function activeBlock(data: RadioData, date: Date) {
  const time = dayIndex(date) * 1440 + colombiaTime(date);
  return data.blocks.find((block) => blockIntervals(block).some(([start, end]) => time >= start && time < end));
}

export function upcomingBlocks(data: RadioData, from: Date, count = 5) {
  const now = dayIndex(from) * 1440 + colombiaTime(from);
  return data.blocks.map((block) => {
    const begin = block.day * 1440 + minutes(block.start);
    return { ...block, distance: (begin - now + 10080) % 10080 };
  }).filter((b) => b.distance > 0).sort((a, b) => a.distance - b.distance).slice(0, count);
}

export function weeklyCoverage(data: RadioData) {
  const intervals = data.blocks.flatMap(blockIntervals).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cursor = 0;
  for (const [start, end] of intervals) {
    total += Math.max(0, end - Math.max(cursor, start));
    cursor = Math.max(cursor, end);
  }
  return Math.round(total / 10080 * 100);
}

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
