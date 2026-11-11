"use client";

import { useState } from "react";
import { AlertCircle, Check, Download, Trash2, Upload } from "lucide-react";
import { fallbackPlaylist, RadioData } from "@/domain/radio";
import { ModalFrame } from "@/features/shared/ui";

export type StationSettings = { station: string; fallbackPlaylistId?: string };
export function SettingsModal({data,onClose,onSave,onExport,onImport,onReset}:{data:RadioData;onClose:()=>void;onSave:(settings:StationSettings)=>void;onExport:()=>void;onImport:()=>void;onReset:()=>void}) {
  const [name,setName]=useState(data.station); const [fallbackId,setFallbackId]=useState(fallbackPlaylist(data)?.id||"");
  return <ModalFrame title="Mi emisora" subtitle="Personaliza la estación y gestiona tus borradores." onClose={onClose}><div className="modal-form"><label>Nombre de la emisora<input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre de tu emisora"/></label><label>Playlist de respaldo<select value={fallbackId} onChange={e=>setFallbackId(e.target.value)}>{data.playlists.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><p className="form-hint">Suena en las horas que no cubre ningún bloque de la parrilla.</p><button className="button-primary" onClick={()=>name.trim()&&onSave({station:name.trim(),fallbackPlaylistId:fallbackId||undefined})}><Check size={17}/> Guardar cambios</button><div className="settings-divider"/><h3>Respaldos de programación</h3><p className="setting-explainer">Exporta o importa un JSON con playlists, bloques y campañas. Los archivos de audio no se incluyen.</p><div className="settings-actions"><button onClick={onExport}><Download size={18}/> Exportar JSON</button><button onClick={onImport}><Upload size={18}/> Importar JSON</button></div><div className="settings-divider"/><button className="danger-text" onClick={onReset}><Trash2 size={16}/> Restablecer datos de ejemplo</button><div className="demo-notice settings-warning"><AlertCircle size={17}/><div>La sincronización con AzuraCast se habilitará en otra etapa. No ingreses claves API aquí.</div></div></div></ModalFrame>;
}
