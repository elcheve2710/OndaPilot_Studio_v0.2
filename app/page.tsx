"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertCircle, ArrowDown, ArrowRight, ArrowUp, AudioLines, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Download, FileAudio, Headphones, LayoutDashboard, ListMusic, Megaphone, Menu, MoreHorizontal, Music2, Pause, Play, Plus, Radio, Search, Shuffle, Trash2, Upload, WandSparkles, Waves, X } from "lucide-react";
import { activeBlock, blockDuration, COLORS, conflicts, dayIndex, exportJson, fmtSeconds, formatTime, id, loadAudio, minutes, RadioBlock, RadioData, saveAudio, seedData, Track, upcomingBlocks, WEEK_DAYS, weeklyCoverage } from "@/lib/radio";
import { Metric, PageTitle, SearchBox, EmptyState, WeekTimeline, BlockModal, PlaylistModal, PlaylistEditor, CampaignModal, SettingsModal } from "./radio-components";
import { PlayerPanel } from "./player-panel";

type View = "dashboard" | "schedule" | "library" | "playlists" | "ads" | "player";
type Modal = "block" | "playlist" | "campaign" | "settings" | null;
const nav: { key: View; label: string; icon: typeof Radio }[] = [
  { key: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { key: "schedule", label: "Parrilla semanal", icon: CalendarDays },
  { key: "library", label: "Biblioteca musical", icon: Music2 },
  { key: "playlists", label: "Playlists", icon: ListMusic },
  { key: "ads", label: "Publicidad", icon: Megaphone },
  { key: "player", label: "Cabina de audio", icon: Headphones },
];
const cloneSeed = (): RadioData => JSON.parse(JSON.stringify(seedData));
const todayLabel = (date: Date) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" }).format(date);
const parseSlots = (value: string) => [...new Set(value.split(/[\s,;]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 60))].sort((a, b) => a - b);

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [data, setData] = useState<RadioData>(cloneSeed);
  const [ready, setReady] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  // Stable server/client first render, then update from the visitor's clock.
  const [now, setNow] = useState(() => new Date(0));
  const [editPlaylist, setEditPlaylist] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Track | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<"checking" | "cloud" | "local">("checking");
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const writeVersion = useRef(0);
  const inputAudio = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let local = cloneSeed();
    try {
      const stored = localStorage.getItem("ondapilot-v1");
      if (stored) {
        const parsed = JSON.parse(stored) as RadioData;
        if (Array.isArray(parsed.tracks) && Array.isArray(parsed.playlists) && Array.isArray(parsed.blocks) && Array.isArray(parsed.campaigns)) local = parsed;
      }
    } catch { /* Keep the demonstration data. */ }
    const date = new Date();
    setNow(date);
    setSelectedDay(dayIndex(date));
    let canceled = false;
    const initialize = async () => {
      let initial = local;
      let cloud: "cloud" | "local" = "local";
      try {
        const response = await fetch("/api/radio", { cache: "no-store" });
        if (response.ok) {
          const result = await response.json() as { exists: boolean; data?: RadioData | null };
          if (result.exists && result.data) initial = result.data as RadioData;
          else {
            const saved = await fetch("/api/radio", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(initial) });
            if (!saved.ok) throw new Error("initial save failed");
          }
          cloud = "cloud";
        }
      } catch { /* Local fallback remains available. */ }
      if (!canceled) { setData(initial); setCloudStatus(cloud); setReady(true); }
    };
    void initialize();
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => { canceled = true; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("ondapilot-v1", JSON.stringify(data));
    if (cloudStatus !== "cloud") return;
    const current = ++writeVersion.current;
    const timer = window.setTimeout(() => {
      const snapshot = JSON.stringify(data);
      setSyncStatus("saving");
      writeQueue.current = writeQueue.current.then(async () => {
        try {
          const response = await fetch("/api/radio", { method: "PUT", headers: { "Content-Type": "application/json" }, body: snapshot });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          if (current === writeVersion.current) setSyncStatus("saved");
        } catch { if (current === writeVersion.current) setSyncStatus("error"); }
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [data, ready, cloudStatus]);
  useEffect(() => { if (notice) { const t = window.setTimeout(() => setNotice(""), 4000); return () => window.clearTimeout(t); } }, [notice]);
  useEffect(() => () => { if (audioUrl?.startsWith("blob:")) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const current = useMemo(() => activeBlock(data, now), [data, now]);
  const upcoming = useMemo(() => upcomingBlocks(data, now, 4), [data, now]);
  const currentPlaylist = data.playlists.find((p) => p.id === current?.playlistId);
  const totalMinutes = data.tracks.filter((t) => t.kind === "music").reduce((sum, t) => sum + t.duration, 0);
  const coverage = weeklyCoverage(data);
  const filteredTracks = data.tracks.filter((t) => t.kind === "music" && `${t.title} ${t.artist} ${t.genre}`.toLowerCase().includes(query.toLowerCase()));
  const filteredCampaigns = data.campaigns.filter((c) => `${c.title} ${c.brand}`.toLowerCase().includes(query.toLowerCase()));
  const selectedBlocks = data.blocks.filter((b) => b.day === selectedDay).sort((a, b) => minutes(a.start) - minutes(b.start));
  const activeCampaigns = data.campaigns.filter((c) => c.enabled);
  const weeklyAdSeconds = activeCampaigns.reduce((sum,c)=>sum+c.minuteSlots.length*(data.tracks.find(t=>t.id===c.trackId)?.duration||0),0);

  function changeView(next: View) { setView(next); setQuery(""); setMobileMenu(false); setEditPlaylist(null); }
  function setState(updater: (old: RadioData) => RadioData, message?: string) { setData(updater); if (message) setNotice(message); }
  async function preview(track: Track) {
    if (!track.uploaded) { setNotice("Este es un registro de ejemplo. Importa un audio para poder escucharlo."); return; }
    if (playing?.id === track.id) { setPlaying(null); setAudioUrl(null); return; }
    try {
      if (track.storage === "cloud") { setAudioUrl(`/api/audio?id=${encodeURIComponent(track.id)}`); setPlaying(track); return; }
      const blob = await loadAudio(track.id);
      if (!blob) { setNotice("El archivo no está disponible en este navegador. Vuelve a importarlo."); return; }
      setAudioUrl(URL.createObjectURL(blob)); setPlaying(track);
    } catch { setNotice("No fue posible abrir el archivo de audio."); }
  }
  async function uploadAudio(event: ChangeEvent<HTMLInputElement>, kind: "music" | "ad") {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name));
    if (!files.length) return;
    setUploading(true);
    const added: Track[] = [];
    for (const file of files) {
      const trackId = id();
      try {
        let storage: "cloud" | "local" = "local";
        if (cloudStatus === "cloud") {
          const payload = new FormData();
          payload.append("id", trackId);
          payload.append("audio", file);
          try {
            const result = await fetch("/api/audio", { method: "POST", body: payload });
            if (!result.ok) throw new Error("Upload failed");
            storage = "cloud";
          } catch {
            await saveAudio(trackId, file);
            setNotice(`«${file.name}» se guardó localmente; no se pudo subir a la nube.`);
          }
        } else await saveAudio(trackId, file);
        const base = file.name.replace(/\.[^.]+$/, "");
        const parts = base.split(" - ");
        const title = parts.length > 1 ? parts.slice(1).join(" - ") : base;
        const artist = parts.length > 1 ? parts[0] : "Artista por definir";
        const duration = await new Promise<number>((resolve) => {
          const audio = document.createElement("audio");
          const url = URL.createObjectURL(file);
          const finish = (value: number) => { URL.revokeObjectURL(url); resolve(value); };
          audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0);
          audio.onerror = () => finish(0);
          audio.src = url;
        });
        added.push({ id: trackId, title, artist, genre: kind === "ad" ? "Publicidad" : "Sin clasificar", duration, kind, uploaded: true, storage, fileName: file.name });
      } catch { setNotice(`No se pudo almacenar ${file.name}. Revisa el espacio del navegador.`); }
    }
    setState((old) => ({ ...old, tracks: [...added, ...old.tracks] }), `${added.length} archivo(s) añadidos a la biblioteca`);
    setUploading(false); event.target.value = "";
  }
  function deleteTrack(trackId: string) {
    if (!window.confirm("¿Eliminar este registro y quitarlo de las playlists?")) return;
    const target = data.tracks.find((t) => t.id === trackId);
    if (target?.storage === "cloud") void fetch(`/api/audio?id=${encodeURIComponent(trackId)}`, { method: "DELETE" }).catch(() => setNotice("No se pudo borrar el archivo remoto; revisa el almacenamiento."));
    setState((old) => ({ ...old, tracks: old.tracks.filter((t) => t.id !== trackId), playlists: old.playlists.map((p) => ({ ...p, trackIds: p.trackIds.filter((x) => x !== trackId) })), campaigns: old.campaigns.filter((c) => c.trackId !== trackId) }), "Registro eliminado");
  }
  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()); const incoming = parsed.data as RadioData;
      if (!incoming || !Array.isArray(incoming.tracks) || !Array.isArray(incoming.playlists) || !Array.isArray(incoming.blocks) || !Array.isArray(incoming.campaigns) || typeof incoming.station !== "string") throw new Error("Invalid format");
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
      <div className="sidebar-bottom"><div className="sidebar-help"><div className="help-orb"><WandSparkles size={19} /></div><b>Tu cabina, a tu ritmo.</b><p>Organiza música, horarios y pautas desde un mismo lugar.</p><button onClick={() => setModal("settings")}>Configurar emisora <ArrowRight size={14} /></button></div><div className="sidebar-footer"><span className={`demo-dot ${cloudStatus === "cloud" ? "dot-green" : ""}`} /> {cloudStatus === "cloud" ? syncStatus === "error" ? "Error al guardar en la nube" : syncStatus === "saving" ? "Guardando en la nube…" : "Datos sincronizados en la nube" : "Modo local · Sin conexión a nube"}</div></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div className="topbar-left"><button className="mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Abrir menú"><Menu size={22}/></button><span className="breadcrumb">Estudio</span><ChevronRight size={15}/><span className="breadcrumb-current">{nav.find((n) => n.key === view)?.label}</span></div><div className="topbar-right"><span className="top-date"><CalendarDays size={15}/> {todayLabel(now)}</span><span className="top-separator"/><span className="status-pill"><i/> SIN EMISIÓN PÚBLICA</span><span className="user-avatar">JE</span></div></header>
      <main className="page-content">
        {view === "dashboard" && <>
          <section className="welcome-row"><div><div className="eyebrow">TU CENTRO DE OPERACIONES <span className="eyebrow-line" /></div><h1>Buenos ritmos, <span className="gradient-text">mejor control.</span></h1><p>Todo lo que necesitas para organizar la programación de tu emisora.</p></div><button className="button-primary" onClick={() => { setSelectedDay(dayIndex(now)); setModal("block"); }}><Plus size={18}/> Crear programación</button></section>
          <section className="metrics-grid"><Metric icon={Music2} tone="mint" label="Biblioteca musical" value={String(data.tracks.filter((t) => t.kind === "music").length).padStart(2, "0")} detail={`${Math.floor(totalMinutes / 60)} min de contenido registrado`} /><Metric icon={ListMusic} tone="purple" label="Playlists activas" value={String(data.playlists.length).padStart(2, "0")} detail="Listas listas para programar" /><Metric icon={CalendarDays} tone="orange" label="Bloques semanales" value={String(data.blocks.length).padStart(2, "0")} detail={`${coverage}% de la semana cubierta`} /><Metric icon={Megaphone} tone="blue" label="Campañas de pauta" value={String(activeCampaigns.length).padStart(2, "0")} detail="Activas en el plan editorial" /></section>
          <div className="dashboard-grid"><div className="dashboard-main"><section className="panel schedule-overview"><div className="panel-header"><div><span className="section-kicker">VISIÓN GENERAL</span><h2>Tu semana en el aire <span className="tiny-muted">(simulación)</span></h2></div><button className="link-button" onClick={() => changeView("schedule")}>Abrir parrilla <ArrowRight size={16}/></button></div><WeekTimeline blocks={data.blocks} playlists={data.playlists} onDay={(day) => { setSelectedDay(day); changeView("schedule"); }} today={dayIndex(now)}/><div className="timeline-legend">{data.playlists.map((p) => <span key={p.id}><i style={{background:p.color}}/>{p.name.split(" ")[0]}</span>)}</div></section>
          <section className="panel upcoming-panel"><div className="panel-header"><div><span className="section-kicker">A CONTINUACIÓN</span><h2>Próximos bloques</h2></div><button className="icon-button" aria-label="Abrir parrilla" onClick={() => changeView("schedule")}><ArrowRight size={18}/></button></div><div className="upcoming-list">{upcoming.length ? upcoming.map((block) => { const playlist = data.playlists.find((p) => p.id === block.playlistId); return <div key={block.id} className="upcoming-item"><span className="upcoming-time"><b>{formatTime(block.start).split(" ")[0]}</b><small>{WEEK_DAYS[block.day].slice(0, 3)}</small></span><span className="upcoming-marker" style={{background:playlist?.color || COLORS[0]}}/><span className="upcoming-text"><b>{block.title}</b><small>{playlist?.name || "Playlist eliminada"} · {formatTime(block.start)}–{formatTime(block.end)}</small></span><ChevronRight size={17}/></div>; }) : <EmptyState title="Aún no hay bloques" text="Crea tu primera programación semanal." />}</div></section></div>
          <div className="dashboard-side"><section className="now-panel"><div className="now-top"><span><i/> ESTADO DE PROGRAMACIÓN</span><MoreHorizontal size={20}/></div><div className="visualizer"><span className="visualizer-circle circle-one"/><span className="visualizer-circle circle-two"/><div className="vinyl"><div className="vinyl-inner"><Waves size={35}/></div></div><div className="equalizer">{Array.from({length:25}, (_,i) => <i key={i} style={{height:`${18 + ((i*17+13)%53)}%`}}/>)}</div></div><div className="now-label">{current ? "FRANJA PROGRAMADA AHORA" : "SIN BLOQUE ACTIVO"}</div><h3>{current?.title || "Programación por completar"}</h3><p>{currentPlaylist?.name || "Agrega bloques para cubrir este horario"}</p><div className="now-divider"/><div className="now-meta"><span><Clock3 size={15}/> {current ? `${formatTime(current.start)} - ${formatTime(current.end)}` : "Sin horario"}</span><span><Radio size={15}/> Vista previa</span></div></section>
          <section className="coverage-panel"><div className="coverage-header"><div className="coverage-icon"><Activity size={20}/></div><span>COBERTURA DE LA SEMANA</span></div><div className="coverage-number">{coverage}<small>%</small></div><div className="coverage-bar"><span style={{width:`${coverage}%`}}/></div><p>{coverage === 100 ? "La semana está cubierta. Revisa los cruces." : `Queda ${100 - coverage}% de la semana sin bloques. Para emitir en vivo se necesitará una playlist de respaldo en AzuraCast.`}</p><button onClick={() => changeView("schedule")}>Revisar horarios <ArrowRight size={15}/></button></section></div></div>
          <div className="demo-notice"><AlertCircle size={18}/><div><b>La cabina de audio ya reproduce tus archivos.</b> Abre «Cabina de audio» para escuchar canciones y cuñas. {cloudStatus === "cloud" ? "Tu programación y archivos nuevos se guardan en la nube." : "Estás usando almacenamiento local de respaldo."} La transmisión pública 24/7 se activa al configurar un servidor AzuraCast.</div></div>
        </>}
        {view === "schedule" && <><PageTitle eyebrow="PLANIFICACIÓN" title="Parrilla semanal" description="Diseña los bloques, controla horarios y evita cruces en la programación." action={<button className="button-primary" onClick={() => setModal("block")}><Plus size={17}/> Nuevo bloque</button>} /><div className="schedule-stat-row"><span className="stat-chip"><CalendarDays size={16}/><b>{data.blocks.length}</b> bloques</span><span className="stat-chip"><Activity size={16}/><b>{coverage}%</b> cobertura</span><span className="stat-chip"><Clock3 size={16}/> Zona: <b>Colombia (UTC−5)</b></span></div><section className="panel full-schedule"><div className="panel-header"><div><span className="section-kicker">MAPA DE PROGRAMACIÓN</span><h2>Calendario visual</h2></div><span className="mini-tag">Semana recurrente</span></div><WeekTimeline blocks={data.blocks} playlists={data.playlists} today={dayIndex(now)} selected={selectedDay} onDay={setSelectedDay}/></section><section className="panel day-detail"><div className="panel-header"><div><span className="section-kicker">DETALLE DEL DÍA</span><h2>{WEEK_DAYS[selectedDay]}</h2></div><div className="day-selector"><button aria-label="Día anterior" onClick={() => setSelectedDay((d) => (d+6)%7)}><ChevronLeft size={18}/></button><button aria-label="Día siguiente" onClick={() => setSelectedDay((d) => (d+1)%7)}><ChevronRight size={18}/></button></div></div><div className="day-pills">{WEEK_DAYS.map((day,i) => <button key={day} className={selectedDay===i?"selected":""} onClick={() => setSelectedDay(i)}>{day.slice(0,3)}</button>)}</div><div className="block-list">{selectedBlocks.length ? selectedBlocks.map((block) => { const playlist = data.playlists.find((p) => p.id === block.playlistId); return <div className="block-card" key={block.id}><span className="block-color" style={{background:playlist?.color || COLORS[0]}}/><div className="block-hour"><b>{formatTime(block.start)}</b><small>{formatTime(block.end)} · {(blockDuration(block)/60).toFixed(1)} h</small></div><div className="block-content"><b>{block.title}</b><small><ListMusic size={14}/>{playlist?.name || "Sin playlist"}{minutes(block.end)<=minutes(block.start) && <span className="overnight-tag">Cruza medianoche</span>}</small></div><button title="Eliminar bloque" aria-label="Eliminar bloque" className="icon-button danger-on-hover" onClick={() => setState((old) => ({...old, blocks:old.blocks.filter((b) => b.id!==block.id)}), "Bloque eliminado")}><Trash2 size={17}/></button></div>; }) : <EmptyState title="No hay bloques este día" text="Añade una playlist a una franja horaria para empezar." />}</div><button className="add-inline" onClick={() => setModal("block")}><Plus size={17}/> Añadir bloque al {WEEK_DAYS[selectedDay].toLowerCase()}</button></section></>}
        {view === "library" && <>
          <PageTitle eyebrow="CONTENIDOS" title="Biblioteca musical" description="Importa canciones y escucha una vista previa de tus archivos." action={<button className="button-primary" disabled={uploading} onClick={() => inputAudio.current?.click()}><Upload size={17}/>{uploading ? "Importando…" : "Subir audio"}</button>} />
          <div className="library-intro"><div className="library-icon"><Headphones size={26}/></div><div><b>Tu música, siempre organizada.</b><p>Importa MP3, WAV, OGG, M4A o FLAC. {cloudStatus === "cloud" ? "Tus nuevos audios se guardan en la nube privada de tu cuenta (hasta 25 MB por archivo)." : "En modo local los archivos se guardan en este navegador."}</p></div><button onClick={() => inputAudio.current?.click()}><Plus size={17}/> Agregar</button></div>
          <section className="panel library-panel"><div className="panel-header"><div><span className="section-kicker">COLECCIÓN</span><h2>Canciones <span className="counter-badge">{filteredTracks.length}</span></h2></div><SearchBox value={query} onChange={setQuery} placeholder="Buscar canción, artista o género"/></div>
            <div className="table-scroll"><table className="data-table"><thead><tr><th>CANCIÓN</th><th>GÉNERO</th><th>ORIGEN</th><th>DURACIÓN</th><th></th></tr></thead><tbody>{filteredTracks.map((track) => <tr key={track.id}><td><div className="track-cell"><button className="track-play" onClick={() => preview(track)} aria-label={`Escuchar ${track.title}`}>{playing?.id === track.id ? <Pause size={17}/> : <Play size={16} fill="currentColor"/>}</button><div><b>{track.title}</b><small>{track.artist}</small></div></div></td><td><span className="genre-tag">{track.genre}</span></td><td><span className={track.uploaded ? "source-upload" : "source-demo"}>{!track.uploaded ? "Ejemplo" : track.storage === "cloud" ? "En la nube" : "Local"}</span></td><td className="duration-col">{fmtSeconds(track.duration)}</td><td><button className="icon-button danger-on-hover" title="Eliminar registro" aria-label="Eliminar registro" onClick={() => deleteTrack(track.id)}><Trash2 size={16}/></button></td></tr>)}</tbody></table>{!filteredTracks.length && <EmptyState title="No encontramos canciones" text="Prueba otra búsqueda o importa un audio." />}</div>
          </section>
        </>}
        {view === "playlists" && <><PageTitle eyebrow="COLECCIONES" title="Playlists" description="Agrupa canciones, decide su orden y úsalas en la programación." action={<button className="button-primary" onClick={() => setModal("playlist")}><Plus size={17}/> Crear playlist</button>}/><div className="playlist-grid">{data.playlists.map((playlist) => { const duration = playlist.trackIds.reduce((sum, trackId) => sum + (data.tracks.find((track)=>track.id===trackId)?.duration || 0), 0); return <button key={playlist.id} className={`playlist-card ${editPlaylist===playlist.id ? "playlist-selected" : ""}`} onClick={() => setEditPlaylist(editPlaylist===playlist.id ? null : playlist.id)}><div className="playlist-art" style={{background:`radial-gradient(circle at 25% 25%, ${playlist.color}80, transparent 55%), linear-gradient(135deg, ${playlist.color}30, #171e2b)`}}><div className="record-disc"><AudioLines size={27} color={playlist.color}/></div><span className="art-menu"><MoreHorizontal size={20}/></span></div><div className="playlist-meta"><h3>{playlist.name}</h3><p>{playlist.description}</p><div className="playlist-footer"><span><ListMusic size={15}/>{playlist.trackIds.length} canciones</span><span><Clock3 size={15}/>{Math.floor(duration/60)} min</span></div></div></button>; })}<button className="new-playlist-card" onClick={() => setModal("playlist")}><span><Plus size={26}/></span><b>Nueva playlist</b><small>Crea una colección desde cero</small></button></div>{editPlaylist && <PlaylistEditor playlistId={editPlaylist} data={data} setData={setState} close={() => setEditPlaylist(null)} />}</>}
        {view === "ads" && <><PageTitle eyebrow="MONETIZACIÓN" title="Publicidad y cuñas" description="Organiza campañas y define los minutos previstos para cada pauta." action={<button className="button-primary" onClick={() => setModal("campaign")}><Plus size={17}/> Nueva campaña</button>}/><div className="ads-top"><div className="ad-stat"><Megaphone size={22}/><div><small>CAMPAÑAS ACTIVAS</small><b>{activeCampaigns.length}</b></div></div><div className="ad-stat"><FileAudio size={22}/><div><small>CUÑAS EN BIBLIOTECA</small><b>{data.tracks.filter(t=>t.kind==="ad").length}</b></div></div><div className="ad-stat"><Clock3 size={22}/><div><small>MIN DE PAUTA / HORA</small><b>{(weeklyAdSeconds/60).toFixed(1)}</b></div></div></div><div className="ads-actions"><SearchBox value={query} onChange={setQuery} placeholder="Buscar campaña"/><button className="button-secondary" onClick={() => inputAudio.current?.click()}><Upload size={16}/> Importar cuñas</button></div><div className="campaign-list">{filteredCampaigns.length ? filteredCampaigns.map((campaign) => { const spot = data.tracks.find((track)=>track.id===campaign.trackId); return <div className="campaign-card" key={campaign.id}><div className="campaign-symbol"><Megaphone size={22}/></div><div className="campaign-main"><b>{campaign.title}</b><small>{campaign.brand} · {spot?.title || "Archivo no encontrado"}</small><div className="campaign-slots">{campaign.minuteSlots.map((slot)=><span key={slot}>:{String(slot).padStart(2,"0")}</span>)} <span className="spot-duration">{spot ? `${spot.duration} segundos` : "Sin audio"}</span></div></div><label className="switch" aria-label={`Activar ${campaign.title}`}><input type="checkbox" checked={campaign.enabled} onChange={(e)=>setState(old=>({...old,campaigns:old.campaigns.map(c=>c.id===campaign.id?{...c,enabled:e.target.checked}:c)}))}/><span/></label><button className="icon-button danger-on-hover" onClick={()=>setState(old=>({...old,campaigns:old.campaigns.filter(c=>c.id!==campaign.id)}), "Campaña eliminada")} title="Eliminar campaña"><Trash2 size={18}/></button></div>; }) : <EmptyState title="Sin campañas" text="Crea una campaña o modifica tu búsqueda." />}</div><div className="demo-notice ads-notice"><AlertCircle size={18}/><div>Las cuñas se pueden poner en cola desde la <b>Cabina de audio</b>. La emisión a oyentes externos requiere conectar AzuraCast.</div></div></>}
        {view === "player" && <><PageTitle eyebrow="OPERACIÓN" title="Cabina de reproducción" description="Escucha música y cuñas reales desde el navegador, con reproducción continua de tu playlist." action={<button className="button-secondary" onClick={() => changeView("library")}><Upload size={17}/> Cargar más audio</button>}/><PlayerPanel data={data} onViewLibrary={() => changeView("library")}/></>}
      </main>
    </div>
    <input ref={inputAudio} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" multiple hidden onChange={(event)=>uploadAudio(event,view==="ads"?"ad":"music")}/>
    <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={importJson}/>
    {playing && audioUrl && <div className="audio-dock"><div className="audio-dock-icon"><Music2 size={22}/></div><div className="audio-dock-info"><b>{playing.title}</b><small>{playing.artist} · Vista previa</small></div><audio src={audioUrl} controls autoPlay /><button className="icon-button" aria-label="Cerrar reproductor" onClick={()=>{setPlaying(null);setAudioUrl(null);}}><X size={18}/></button></div>}
    {notice && <div className="toast-message"><Check size={17}/>{notice}</div>}
    {modal === "block" && <BlockModal data={data} day={selectedDay} onClose={()=>setModal(null)} onSave={(block)=>{setState((old)=>({...old,blocks:[...old.blocks,block]}),"Bloque programado correctamente");setModal(null);setSelectedDay(block.day);setView("schedule");}} />}
    {modal === "playlist" && <PlaylistModal onClose={()=>setModal(null)} onSave={(playlist)=>{setState((old)=>({...old,playlists:[...old.playlists,playlist]}),"Playlist creada");setModal(null);setView("playlists");setEditPlaylist(playlist.id);}} />}
    {modal === "campaign" && <CampaignModal data={data} onClose={()=>setModal(null)} onSave={(campaign)=>{setState((old)=>({...old,campaigns:[...old.campaigns,campaign]}),"Campaña creada");setModal(null);setView("ads");}} />}
    {modal === "settings" && <SettingsModal station={data.station} onClose={()=>setModal(null)} onSave={(station)=>{setState(old=>({...old,station}),"Estación actualizada");setModal(null);}} onExport={()=>exportJson(data)} onImport={()=>{setModal(null);importInput.current?.click();}} onReset={()=>{if(window.confirm("¿Restablecer los datos de demostración? Se perderán los cambios de programación.")){setData(cloneSeed());setNotice("Datos de ejemplo restablecidos");setModal(null);}}} />}
  </div>;
}
