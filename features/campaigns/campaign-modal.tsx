"use client";

import { useState } from "react";
import { Clock3, Plus } from "lucide-react";
import { id, RadioData } from "@/domain/radio";
import { ModalFrame } from "@/features/shared/ui";

export function CampaignModal({data,onClose,onSave}:{data:RadioData;onClose:()=>void;onSave:(campaign:RadioData["campaigns"][number])=>void}) {
  const [title,setTitle]=useState("");const [brand,setBrand]=useState("");const [trackId,setTrackId]=useState(data.tracks.find(t=>t.kind==="ad")?.id||"");const [slots,setSlots]=useState("15, 45");const [error,setError]=useState("");const ads=data.tracks.filter(t=>t.kind==="ad");
  return <ModalFrame title="Nueva campaña" subtitle="Planifica cuándo deberían sonar las cuñas." onClose={onClose}><form className="modal-form" onSubmit={e=>{e.preventDefault();const parsed=[...new Set(slots.split(/[\s,;]+/).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<60))].sort((a,b)=>a-b);if(!title.trim()||!brand.trim()||!trackId||!parsed.length){setError("Completa los campos e indica minutos válidos (0–59).");return;}onSave({id:id(),title:title.trim(),brand:brand.trim(),trackId,minuteSlots:parsed,enabled:true});}}><label>Nombre de campaña<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej. Promoción de noviembre"/></label><label>Cliente / anunciante<input required value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Nombre comercial"/></label><label>Cuña de audio<select value={trackId} required onChange={e=>setTrackId(e.target.value)}>{ads.map(t=><option key={t.id} value={t.id}>{t.title} ({t.duration} s)</option>)}</select></label><label>Minutos previstos de cada hora<input value={slots} onChange={e=>setSlots(e.target.value)} placeholder="Ej. 15, 45"/></label><p className="form-hint"><Clock3 size={15}/> Ejemplo: 15, 45 representa dos tandas previstas por hora. La ejecución real requiere integración.</p>{error&&<p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Plus size={17}/> Crear campaña</button></div></form></ModalFrame>;
}
