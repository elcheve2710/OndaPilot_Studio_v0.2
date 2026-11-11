"use client";

import { useState } from "react";
import { Headphones, Pause, Play, Plus, Trash2, Upload } from "lucide-react";
import { fmtSeconds, RadioData, Track } from "@/domain/radio";
import type { CloudStatus } from "@/features/station/use-station";
import { EmptyState, PageTitle, SearchBox } from "@/features/shared/ui";

export function LibraryView({ data, cloud, uploading, playingId, onUpload, onPreview, onDelete }: { data: RadioData; cloud: CloudStatus; uploading: boolean; playingId?: string; onUpload: () => void; onPreview: (track: Track) => void; onDelete: (trackId: string) => void }) {
  const [query, setQuery] = useState("");
  const tracks = data.tracks.filter((t) => t.kind === "music" && `${t.title} ${t.artist} ${t.genre}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageTitle eyebrow="CONTENIDOS" title="Biblioteca musical" description="Importa canciones y escucha una vista previa de tus archivos." action={<button className="button-primary" disabled={uploading} onClick={onUpload}><Upload size={17}/>{uploading ? "Importando…" : "Subir audio"}</button>} />
    <div className="library-intro"><div className="library-icon"><Headphones size={26}/></div><div><b>Tu música, siempre organizada.</b><p>Importa MP3, WAV, OGG, M4A o FLAC. {cloud === "cloud" ? "Tus nuevos audios se guardan en la nube privada de tu cuenta (hasta 25 MB por archivo)." : "En modo local los archivos se guardan en este navegador."}</p></div><button onClick={onUpload}><Plus size={17}/> Agregar</button></div>
    <section className="panel library-panel"><div className="panel-header"><div><span className="section-kicker">COLECCIÓN</span><h2>Canciones <span className="counter-badge">{tracks.length}</span></h2></div><SearchBox value={query} onChange={setQuery} placeholder="Buscar canción, artista o género"/></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>CANCIÓN</th><th>GÉNERO</th><th>ORIGEN</th><th>DURACIÓN</th><th></th></tr></thead><tbody>{tracks.map((track) => <tr key={track.id}><td><div className="track-cell"><button className="track-play" onClick={() => onPreview(track)} aria-label={`Escuchar ${track.title}`}>{playingId === track.id ? <Pause size={17}/> : <Play size={16} fill="currentColor"/>}</button><div><b>{track.title}</b><small>{track.artist}</small></div></div></td><td><span className="genre-tag">{track.genre}</span></td><td><span className={track.uploaded ? "source-upload" : "source-demo"}>{!track.uploaded ? "Ejemplo" : track.storage === "cloud" ? "En la nube" : "Local"}</span></td><td className="duration-col">{fmtSeconds(track.duration)}</td><td><button className="icon-button danger-on-hover" title="Eliminar registro" aria-label="Eliminar registro" onClick={() => onDelete(track.id)}><Trash2 size={16}/></button></td></tr>)}</tbody></table>{!tracks.length && <EmptyState title="No encontramos canciones" text="Prueba otra búsqueda o importa un audio." />}</div>
    </section>
  </>;
}
