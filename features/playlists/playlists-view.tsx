"use client";

import { useState } from "react";
import { AudioLines, Clock3, ListMusic, MoreHorizontal, Plus } from "lucide-react";
import { RadioData } from "@/domain/radio";
import type { StationChange } from "@/features/station/use-station";
import { PageTitle } from "@/features/shared/ui";
import { PlaylistEditor, PlaylistModal } from "./playlist-editor";

export function PlaylistsView({ data, change }: { data: RadioData; change: StationChange }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  return <>
    <PageTitle eyebrow="COLECCIONES" title="Playlists" description="Agrupa canciones, decide su orden y úsalas en la programación." action={<button className="button-primary" onClick={() => setCreating(true)}><Plus size={17}/> Crear playlist</button>}/>
    <div className="playlist-grid">{data.playlists.map((playlist) => { const duration = playlist.trackIds.reduce((sum, trackId) => sum + (data.tracks.find((track)=>track.id===trackId)?.duration || 0), 0); return <button key={playlist.id} className={`playlist-card ${editing===playlist.id ? "playlist-selected" : ""}`} onClick={() => setEditing(editing===playlist.id ? null : playlist.id)}><div className="playlist-art" style={{background:`radial-gradient(circle at 25% 25%, ${playlist.color}80, transparent 55%), linear-gradient(135deg, ${playlist.color}30, #171e2b)`}}><div className="record-disc"><AudioLines size={27} color={playlist.color}/></div><span className="art-menu"><MoreHorizontal size={20}/></span></div><div className="playlist-meta"><h3>{playlist.name}</h3><p>{playlist.description}</p><div className="playlist-footer"><span><ListMusic size={15}/>{playlist.trackIds.length} canciones</span><span><Clock3 size={15}/>{Math.floor(duration/60)} min</span></div></div></button>; })}<button className="new-playlist-card" onClick={() => setCreating(true)}><span><Plus size={26}/></span><b>Nueva playlist</b><small>Crea una colección desde cero</small></button></div>
    {editing && <PlaylistEditor playlistId={editing} data={data} setData={change} close={() => setEditing(null)} />}
    {creating && <PlaylistModal onClose={() => setCreating(false)} onSave={(playlist) => { change((old) => ({...old, playlists:[...old.playlists, playlist]}), "Playlist creada"); setCreating(false); setEditing(playlist.id); }} />}
  </>;
}
