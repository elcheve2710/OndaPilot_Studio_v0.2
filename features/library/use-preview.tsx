"use client";

import { useEffect, useState } from "react";
import { Music2, X } from "lucide-react";
import { Track } from "@/domain/radio";
import { loadAudio } from "@/infrastructure/browser/local-media";

// Library preview: one track at a time, played in a dock that stays open across views.
export function usePreview(notify: (message: string) => void) {
  const [playing, setPlaying] = useState<{ track: Track; url: string } | null>(null);
  const url = playing?.url;
  useEffect(() => () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); }, [url]);

  async function toggle(track: Track) {
    if (!track.uploaded) { notify("Este es un registro de ejemplo. Importa un audio para poder escucharlo."); return; }
    if (playing?.track.id === track.id) { setPlaying(null); return; }
    try {
      if (track.storage === "cloud") { setPlaying({ track, url: `/api/audio?id=${encodeURIComponent(track.id)}` }); return; }
      const blob = await loadAudio(track.id);
      if (!blob) { notify("El archivo no está disponible en este navegador. Vuelve a importarlo."); return; }
      setPlaying({ track, url: URL.createObjectURL(blob) });
    } catch { notify("No fue posible abrir el archivo de audio."); }
  }

  const dock = playing && <div className="audio-dock"><div className="audio-dock-icon"><Music2 size={22}/></div><div className="audio-dock-info"><b>{playing.track.title}</b><small>{playing.track.artist} · Vista previa</small></div><audio src={playing.url} controls autoPlay /><button className="icon-button" aria-label="Cerrar reproductor" onClick={() => setPlaying(null)}><X size={18}/></button></div>;
  return { playingId: playing?.track.id, toggle, dock };
}
