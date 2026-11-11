"use client";

import { useState } from "react";
import { AlertCircle, Clock3, FileAudio, Megaphone, Plus, Trash2, Upload } from "lucide-react";
import { RadioData } from "@/domain/radio";
import type { StationChange } from "@/features/station/use-station";
import { EmptyState, PageTitle, SearchBox } from "@/features/shared/ui";
import { CampaignModal } from "./campaign-modal";

export function CampaignsView({ data, change, onUploadSpots }: { data: RadioData; change: StationChange; onUploadSpots: () => void }) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const campaigns = data.campaigns.filter((c) => `${c.title} ${c.brand}`.toLowerCase().includes(query.toLowerCase()));
  const activeCampaigns = data.campaigns.filter((c) => c.enabled);
  const weeklyAdSeconds = activeCampaigns.reduce((sum,c)=>sum+c.minuteSlots.length*(data.tracks.find(t=>t.id===c.trackId)?.duration||0),0);
  return <>
    <PageTitle eyebrow="MONETIZACIÓN" title="Publicidad y cuñas" description="Organiza campañas y define los minutos previstos para cada pauta." action={<button className="button-primary" onClick={() => setCreating(true)}><Plus size={17}/> Nueva campaña</button>}/>
    <div className="ads-top"><div className="ad-stat"><Megaphone size={22}/><div><small>CAMPAÑAS ACTIVAS</small><b>{activeCampaigns.length}</b></div></div><div className="ad-stat"><FileAudio size={22}/><div><small>CUÑAS EN BIBLIOTECA</small><b>{data.tracks.filter(t=>t.kind==="ad").length}</b></div></div><div className="ad-stat"><Clock3 size={22}/><div><small>MIN DE PAUTA / HORA</small><b>{(weeklyAdSeconds/60).toFixed(1)}</b></div></div></div>
    <div className="ads-actions"><SearchBox value={query} onChange={setQuery} placeholder="Buscar campaña"/><button className="button-secondary" onClick={onUploadSpots}><Upload size={16}/> Importar cuñas</button></div>
    <div className="campaign-list">{campaigns.length ? campaigns.map((campaign) => { const spot = data.tracks.find((track)=>track.id===campaign.trackId); return <div className="campaign-card" key={campaign.id}><div className="campaign-symbol"><Megaphone size={22}/></div><div className="campaign-main"><b>{campaign.title}</b><small>{campaign.brand} · {spot?.title || "Archivo no encontrado"}</small><div className="campaign-slots">{campaign.minuteSlots.map((slot)=><span key={slot}>:{String(slot).padStart(2,"0")}</span>)} <span className="spot-duration">{spot ? `${spot.duration} segundos` : "Sin audio"}</span></div></div><label className="switch" aria-label={`Activar ${campaign.title}`}><input type="checkbox" checked={campaign.enabled} onChange={(e)=>change(old=>({...old,campaigns:old.campaigns.map(c=>c.id===campaign.id?{...c,enabled:e.target.checked}:c)}))}/><span/></label><button className="icon-button danger-on-hover" onClick={()=>change(old=>({...old,campaigns:old.campaigns.filter(c=>c.id!==campaign.id)}), "Campaña eliminada")} title="Eliminar campaña"><Trash2 size={18}/></button></div>; }) : <EmptyState title="Sin campañas" text="Crea una campaña o modifica tu búsqueda." />}</div>
    <div className="demo-notice ads-notice"><AlertCircle size={18}/><div>Las cuñas se pueden poner en cola desde la <b>Cabina de audio</b>. La emisión a oyentes externos requiere conectar AzuraCast.</div></div>
    {creating && <CampaignModal data={data} onClose={() => setCreating(false)} onSave={(campaign) => { change((old) => ({...old, campaigns:[...old.campaigns, campaign]}), "Campaña creada"); setCreating(false); }} />}
  </>;
}
