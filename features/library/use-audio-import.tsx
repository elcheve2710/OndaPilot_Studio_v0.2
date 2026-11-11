"use client";

import { ChangeEvent, useRef, useState } from "react";
import { id, Track } from "@/domain/radio";
import { saveAudio } from "@/infrastructure/browser/local-media";
import type { CloudStatus } from "@/features/station/use-station";

const audioName = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;

function readDuration(file: File) {
  return new Promise<number>((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const finish = (value: number) => { URL.revokeObjectURL(url); resolve(value); };
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0);
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}

// "Artista - Título.mp3" → artist and title; anything else becomes the title.
function describe(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "");
  const parts = base.split(" - ");
  return parts.length > 1 ? { title: parts.slice(1).join(" - "), artist: parts[0] } : { title: base, artist: "Artista por definir" };
}

// Uploads to cloud storage when available, otherwise (or on failure) keeps the file in IndexedDB.
export function useAudioImport({ cloud, onAdded, notify }: { cloud: CloudStatus; onAdded: (tracks: Track[]) => void; notify: (message: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const kind = useRef<"music" | "ad">("music");

  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("audio/") || audioName.test(file.name));
    if (!files.length) return;
    setUploading(true);
    const added: Track[] = [];
    for (const file of files) {
      const trackId = id();
      try {
        let storage: "cloud" | "local" = "local";
        if (cloud === "cloud") {
          const payload = new FormData();
          payload.append("id", trackId);
          payload.append("audio", file);
          try {
            const result = await fetch("/api/audio", { method: "POST", body: payload });
            if (!result.ok) throw new Error("Upload failed");
            storage = "cloud";
          } catch {
            await saveAudio(trackId, file);
            notify(`«${file.name}» se guardó localmente; no se pudo subir a la nube.`);
          }
        } else await saveAudio(trackId, file);
        const isAd = kind.current === "ad";
        added.push({ id: trackId, ...describe(file.name), genre: isAd ? "Publicidad" : "Sin clasificar", duration: await readDuration(file), kind: kind.current, uploaded: true, storage, fileName: file.name });
      } catch { notify(`No se pudo almacenar ${file.name}. Revisa el espacio del navegador.`); }
    }
    onAdded(added);
    setUploading(false); event.target.value = "";
  }

  const pick = (next: "music" | "ad") => { kind.current = next; input.current?.click(); };
  const element = <input ref={input} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" multiple hidden onChange={importFiles}/>;
  return { uploading, pick, input: element };
}
