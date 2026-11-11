"use client";

import { ChangeEvent, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, AudioLines, CalendarDays, Check, ChevronDown, ChevronRight, Headphones, LayoutDashboard, ListMusic, Megaphone, Menu, Music2, Radio, Upload, WandSparkles } from "lucide-react";
import { dayIndex, removeTrack } from "@/domain/radio";
import { parseRadioData } from "@/domain/schemas";
import { exportJson } from "@/infrastructure/browser/local-media";
import { CampaignsView } from "@/features/campaigns/campaigns-view";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { LibraryView } from "@/features/library/library-view";
import { useAudioImport } from "@/features/library/use-audio-import";
import { usePreview } from "@/features/library/use-preview";
import { PlayerPanel } from "@/features/player/player-panel";
import { PlaylistsView } from "@/features/playlists/playlists-view";
import { BlockModal } from "@/features/schedule/block-modal";
import { ScheduleView } from "@/features/schedule/schedule-view";
import { PageTitle } from "@/features/shared/ui";
import { useNotice } from "@/features/shared/use-notice";
import { useNow } from "@/features/shared/use-now";
import type { View } from "@/features/shared/views";
import { SettingsModal } from "@/features/station/settings-modal";
import { cloneSeed, StationChange, SyncStatus, useStation } from "@/features/station/use-station";

type Modal = "block" | "settings" | null;
const nav: { key: View; label: string; icon: typeof Radio }[] = [
  { key: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { key: "schedule", label: "Parrilla semanal", icon: CalendarDays },
  { key: "library", label: "Biblioteca musical", icon: Music2 },
  { key: "playlists", label: "Playlists", icon: ListMusic },
  { key: "ads", label: "Publicidad", icon: Megaphone },
  { key: "player", label: "Cabina de audio", icon: Headphones },
];
const todayLabel = (date: Date) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" }).format(date);
const syncLabel: Record<SyncStatus, string> = { idle: "Datos sincronizados en la nube", saved: "Datos sincronizados en la nube", saving: "Guardando en la nube…", error: "Error al guardar en la nube", conflict: "Cambios sin guardar: hay otra versión" };

// App shell: navigation, station state and the modals shared by several views. Each view lives in features/.
export default function Home() {
  const station = useStation();
  const { data, setData, ready, cloud, sync, conflict } = station;
  const [notice, setNotice] = useNotice();
  const now = useNow();
  const [view, setView] = useState<View>("dashboard");
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const today = dayIndex(now);
  const selectedDay = pickedDay ?? today;

  const change: StationChange = (updater, message) => { setData(updater); if (message) setNotice(message); };
  const preview = usePreview(setNotice);
  const audioImport = useAudioImport({ cloud, notify: setNotice, onAdded: (added) => change((old) => ({ ...old, tracks: [...added, ...old.tracks] }), `${added.length} archivo(s) añadidos a la biblioteca`) });

  function changeView(next: View) { setView(next); setMobileMenu(false); }
  function createBlock(day = selectedDay) { setPickedDay(day); setModal("block"); }
  function deleteTrack(trackId: string) {
    if (!window.confirm("¿Eliminar este registro y quitarlo de las playlists?")) return;
    if (data.tracks.find((t) => t.id === trackId)?.storage === "cloud") void fetch(`/api/audio?id=${encodeURIComponent(trackId)}`, { method: "DELETE" }).catch(() => setNotice("No se pudo borrar el archivo remoto; revisa el almacenamiento."));
    change((old) => removeTrack(old, trackId), "Registro eliminado");
  }
  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const incoming = parseRadioData(JSON.parse(await file.text())?.data);
      if (!incoming) throw new Error("Invalid format");
      if (window.confirm("¿Reemplazar tu programación actual con este archivo?")) { setData(incoming); setNotice("Programación importada. Los audios deben existir en este navegador."); }
    } catch { setNotice("No fue posible leer este archivo de programación JSON."); }
    event.target.value = "";
  }

  if (!ready) return <div className="app-loading"><span className="brand-mark"><AudioLines size={26}/></span><b>Preparando OndaPilot Studio…</b></div>;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <button className="brand" onClick={() => changeView("dashboard")}><span className="brand-mark"><AudioLines size={25} strokeWidth={2.6} /></span><span><span className="brand-title">onda<span>pilot</span></span><span className="brand-caption">RADIO STUDIO <b>· BETA</b></span></span></button>
      <div className="station-switch"><span className="station-avatar"><Radio size={18} /></span><span className="station-info"><b>{data.station}</b><small>Estudio de programación</small></span><ChevronDown size={15} /></div>
      <div className="nav-label">ESPACIO DE TRABAJO</div>
      <nav className="side-nav" aria-label="Navegación principal">{nav.map(({ key, label, icon: Icon }) => <button key={key} className={`nav-button ${view === key ? "active" : ""}`} onClick={() => changeView(key)}><Icon size={19} strokeWidth={1.8} /><span>{label}</span>{view === key && <span className="nav-active-line" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><div className="help-orb"><WandSparkles size={19} /></div><b>Tu cabina, a tu ritmo.</b><p>Organiza música, horarios y pautas desde un mismo lugar.</p><button onClick={() => setModal("settings")}>Configurar emisora <ArrowRight size={14} /></button></div><div className="sidebar-footer"><span className={`demo-dot ${cloud !== "cloud" ? "" : sync === "conflict" || sync === "error" ? "dot-warning" : "dot-green"}`} /> {cloud === "cloud" ? syncLabel[sync] : "Modo local · Sin conexión a nube"}</div></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div className="topbar-left"><button className="mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Abrir menú"><Menu size={22}/></button><span className="breadcrumb">Estudio</span><ChevronRight size={15}/><span className="breadcrumb-current">{nav.find((n) => n.key === view)?.label}</span></div><div className="topbar-right"><span className="top-date"><CalendarDays size={15}/> {todayLabel(now)}</span><span className="top-separator"/><span className="status-pill"><i/> SIN EMISIÓN PÚBLICA</span><span className="user-avatar">JE</span></div></header>
      <main className="page-content">
        {view === "dashboard" && <DashboardView data={data} now={now} cloud={cloud} onNavigate={changeView} onOpenDay={(day) => { setPickedDay(day); changeView("schedule"); }} onCreateBlock={() => createBlock(today)} />}
        {view === "schedule" && <ScheduleView data={data} change={change} today={today} day={selectedDay} onDay={setPickedDay} onCreateBlock={() => createBlock()} />}
        {view === "library" && <LibraryView data={data} cloud={cloud} uploading={audioImport.uploading} playingId={preview.playingId} onUpload={() => audioImport.pick("music")} onPreview={preview.toggle} onDelete={deleteTrack} />}
        {view === "playlists" && <PlaylistsView data={data} change={change} />}
        {view === "ads" && <CampaignsView data={data} change={change} onUploadSpots={() => audioImport.pick("ad")} />}
        {view === "player" && <><PageTitle eyebrow="OPERACIÓN" title="Cabina de reproducción" description="Escucha música y cuñas reales desde el navegador, con reproducción continua de tu playlist." action={<button className="button-secondary" onClick={() => changeView("library")}><Upload size={17}/> Cargar más audio</button>}/><PlayerPanel data={data} onViewLibrary={() => changeView("library")}/></>}
      </main>
    </div>
    {audioImport.input}
    <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={importJson}/>
    {preview.dock}
    {conflict && <div className="sync-conflict" role="alertdialog" aria-label="Conflicto al guardar"><AlertTriangle size={18}/><div><b>Otra sesión guardó cambios en esta emisora.</b> Tus últimos cambios no se han guardado. Elige con qué versión seguir.<div className="sync-conflict-actions"><button onClick={station.keepServer}>Cargar la versión guardada</button><button onClick={() => { if (window.confirm("¿Sobrescribir la versión guardada con la tuya? Se perderán los cambios de la otra sesión.")) station.keepMine(); }}>Sobrescribir con la mía</button></div></div></div>}
    {notice && <div className="toast-message"><Check size={17}/>{notice}</div>}
    {modal === "block" && <BlockModal data={data} day={selectedDay} onClose={() => setModal(null)} onSave={(block) => { change((old) => ({ ...old, blocks: [...old.blocks, block] }), "Bloque programado correctamente"); setModal(null); setPickedDay(block.day); setView("schedule"); }} />}
    {modal === "settings" && <SettingsModal data={data} onClose={() => setModal(null)} onSave={(settings) => { change((old) => ({ ...old, ...settings }), "Emisora actualizada"); setModal(null); }} onExport={() => exportJson(data)} onImport={() => { setModal(null); importInput.current?.click(); }} onReset={() => { if (window.confirm("¿Restablecer los datos de demostración? Se perderán los cambios de programación.")) { setData(cloneSeed()); setNotice("Datos de ejemplo restablecidos"); setModal(null); } }} />}
  </div>;
}
