"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, AudioLines, Check, Clock3, Headphones, ListMusic, Megaphone, Pause, Play, Radio, SkipForward, Volume2, Waves } from "lucide-react";
import { activeBlock, dayIndex, fmtSeconds, loadAudio, RadioData, Track } from "@/lib/radio";

type AzuraState = { configured: boolean; connected: boolean; isOnline?: boolean; stationName?: string; song?: string | null; artist?: string | null; listeners?: number | null; streamUrl?: string | null; error?: string };

function playable(track: Track | undefined): track is Track { return Boolean(track?.uploaded); }
function currentMinuteInColombia() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", hourCycle: "h23", hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const val = (key: string) => parts.find((part) => part.type === key)?.value || "00";
  return { stamp: `${val("year")}-${val("month")}-${val("day")} ${val("hour")}:${val("minute")}`, minute: Number(val("minute")) };
}

export function PlayerPanel({ data, onViewLibrary }: { data: RadioData; onViewLibrary: () => void }) {
  const [playlistId, setPlaylistId] = useState(() => activeBlock(data, new Date())?.playlistId || data.playlists[0]?.id || "");
  const [sequence, setSequence] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [playbackNonce, setPlaybackNonce] = useState(0);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [pendingAds, setPendingAds] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [autoAds, setAutoAds] = useState(false);
  const [followSchedule, setFollowSchedule] = useState(false);
  const [azura, setAzura] = useState<AzuraState | null>(null);
  const fired = useRef(new Set<string>());
  const audio = useRef<HTMLAudioElement>(null);

  const selectedPlaylist = data.playlists.find((p) => p.id === playlistId);
  const selection = useMemo(() => (selectedPlaylist?.trackIds || []).map((trackId) => data.tracks.find((t) => t.id === trackId)).filter(playable), [selectedPlaylist, data.tracks]);
  const currentId = overrideId || sequence[cursor] || null;
  const current = data.tracks.find((t) => t.id === currentId);
  const next = data.tracks.find((t) => t.id === sequence[(cursor + 1) % (sequence.length || 1)]);
  const availableAds = data.campaigns.map((campaign) => ({ campaign, track: data.tracks.find((t) => t.id === campaign.trackId) })).filter((x) => x.campaign.enabled && playable(x.track));

  useEffect(() => {
    if (!followSchedule) return;
    const update = () => {
      const active = activeBlock(data, new Date());
      const fallback = data.playlists.find((p) => p.name.toLowerCase().includes("rotación")) || data.playlists[0];
      const nextId = active?.playlistId || fallback?.id;
      if (!nextId || nextId === playlistId) return;
      setPlaylistId(nextId);
      if (started) {
        const playlist = data.playlists.find((p) => p.id === nextId);
        const ids = (playlist?.trackIds || []).filter((trackId) => playable(data.tracks.find((t) => t.id === trackId)));
        if (ids.length) { setSequence(playlist?.shuffle ? [...ids].sort(() => Math.random() - .5) : ids); setCursor(0); setOverrideId(null); setPlaybackNonce((n) => n + 1); }
        else setError("La franja automática no tiene audios cargados. Agrega canciones a su playlist.");
      }
    };
    update();
    const timer = window.setInterval(update, 15000);
    return () => window.clearInterval(timer);
  }, [followSchedule, playlistId, started, data]);

  useEffect(() => {
    let canceled = false;
    fetch("/api/azuracast", { cache: "no-store" }).then(async (r) => await r.json() as AzuraState).then((state) => { if (!canceled) setAzura(state); }).catch(() => { if (!canceled) setAzura({ configured: false, connected: false }); });
    return () => { canceled = true; };
  }, []);
  useEffect(() => {
    if (!started || !current) { setSource(null); return; }
    let canceled = false;
    let objectUrl: string | null = null;
    setSource(null);
    setError("");
    const resolveAudio = async () => {
      if (current.storage === "cloud") { if (!canceled) setSource(`/api/audio?id=${encodeURIComponent(current.id)}`); return; }
      try {
        const blob = await loadAudio(current.id);
        if (!blob) throw new Error("Audio no encontrado en este navegador");
        objectUrl = URL.createObjectURL(blob);
        if (!canceled) setSource(objectUrl);
      } catch { if (!canceled) { setError(`El archivo «${current.title}» ya no está disponible.`); setPaused(true); } }
    };
    void resolveAudio();
    return () => { canceled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [current?.id, current?.storage, started, playbackNonce]);
  useEffect(() => {
    if (!autoAds || !started) return;
    const check = () => {
      const clock = currentMinuteInColombia();
      const ids: string[] = [];
      for (const { campaign, track } of availableAds) {
        const fireKey = `${clock.stamp}:${campaign.id}`;
        if (campaign.minuteSlots.includes(clock.minute) && !fired.current.has(fireKey)) { fired.current.add(fireKey); ids.push(track!.id); }
      }
      if (ids.length) setPendingAds((old) => [...old, ...ids]);
      if (fired.current.size > 1000) fired.current.clear();
    };
    const timer = window.setInterval(check, 10000);
    check();
    return () => window.clearInterval(timer);
  }, [autoAds, started, availableAds.map((x) => x.campaign.id + x.campaign.minuteSlots.join(",")).join("|")]);

  function begin() {
    const ids = selection.map((track) => track.id);
    if (!ids.length) { setError("Necesitas agregar archivos de audio reales a la playlist seleccionada."); return; }
    setSequence(selectedPlaylist?.shuffle ? [...ids].sort(() => Math.random() - .5) : ids);
    setCursor(0); setPlaybackNonce((n) => n + 1); setOverrideId(null); setPendingAds([]); setStarted(true); setPaused(false); setError("");
  }
  function advance() {
    setPaused(false);
    setPlaybackNonce((n) => n + 1);
    if (overrideId) {
      if (pendingAds.length) { setOverrideId(pendingAds[0]); setPendingAds((old) => old.slice(1)); }
      else { setOverrideId(null); if (sequence.length) setCursor((index) => (index + 1) % sequence.length); }
      return;
    }
    if (pendingAds.length) { setOverrideId(pendingAds[0]); setPendingAds((old) => old.slice(1)); return; }
    if (sequence.length) setCursor((index) => (index + 1) % sequence.length);
  }
  function togglePause() {
    if (!audio.current) return;
    if (audio.current.paused) { void audio.current.play().catch(() => setError("Pulsa reproducir para permitir audio en este navegador.")); }
    else audio.current.pause();
  }
  const isSpot = current?.kind === "ad";

  return <div className="player-layout">
    <section className="panel player-main-panel">
      <div className="section-kicker">REPRODUCCIÓN DE ARCHIVOS REALES</div>
      <h2>Cabina de audio</h2>
      <p className="player-lead">Reproduce música de forma secuencial, continúa con el siguiente archivo y coloca cuñas entre canciones. Funciona mientras tengas esta sesión abierta.</p>
      <div className="player-stage">
        <div className="player-artwork"><div className="player-disc"><AudioLines size={46}/></div><span className="stage-wave stage-wave-left"/><span className="stage-wave stage-wave-right"/></div>
        <span className={`player-current-tag ${isSpot ? "player-ad-tag" : ""}`}>{isSpot ? "CUÑA PUBLICITARIA" : started ? "REPRODUCCIÓN EN CABINA" : "LISTO PARA REPRODUCIR"}</span>
        <h3>{current?.title || "Selecciona tu playlist"}</h3>
        <p>{current?.artist || "Presiona iniciar para cargar la cola musical"}</p>
        <div className="player-controls"><button className="player-control-secondary" disabled={!started} onClick={advance} aria-label="Saltar al siguiente"><SkipForward size={22}/></button><button className="player-control-main" aria-label={started && !paused ? "Pausar reproducción" : "Iniciar o reanudar reproducción"} onClick={started ? togglePause : begin}>{started && !paused ? <Pause size={26} fill="currentColor"/> : <Play size={26} fill="currentColor"/>}</button><button className="player-control-secondary" disabled={!started} onClick={advance} aria-label="Siguiente canción"><SkipForward size={22}/></button></div>
        {source && <audio ref={audio} key={`${source}-${playbackNonce}`} src={source} autoPlay onCanPlay={() => { void audio.current?.play().catch(() => setError("El navegador bloqueó el inicio automático. Pulsa reproducir.")); }} onEnded={advance} onPlay={() => setPaused(false)} onPause={() => setPaused(true)} onError={() => setError("No fue posible reproducir este formato o archivo.")} controls className="player-native-audio" />}
        {error && <div className="player-error"><AlertCircle size={16}/>{error}</div>}
        <div className="player-source-info"><Volume2 size={16}/><span>Salida de audio: este dispositivo</span><span className="player-tiny-dot"/> <span>Sin transmisión pública</span></div>
      </div>
      <div className="playback-note"><AlertCircle size={17}/><span>Esta cabina sí reproduce audio, pero <b>no es un servidor 24/7</b>. Si cierras la pestaña, se detiene. Para oyentes externos necesitaremos conectar AzuraCast.</span></div>
    </section>
    <aside className="player-side">
      <section className="panel player-queue-panel"><div className="section-kicker">COLA MUSICAL</div><h2>¿Qué sonará?</h2><label className="player-select-label">Playlist<select value={playlistId} disabled={followSchedule} onChange={(e) => { setPlaylistId(e.target.value); setStarted(false); setSource(null); }}>{data.playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select></label><label className="player-check"><input type="checkbox" checked={followSchedule} onChange={(e) => setFollowSchedule(e.target.checked)} /> Seguir automáticamente la parrilla semanal</label><p className="player-small-text">Al cambiar de franja se carga su playlist. En horarios libres se usa la rotación de respaldo.</p><div className="player-queue-list">{selection.length ? selection.map((track, i) => <div key={track.id} className={`player-queue-item ${track.id === current?.id && !isSpot ? "playing" : ""}`}><span className="player-queue-number">{String(i+1).padStart(2,"0")}</span><div><b>{track.title}</b><small>{track.artist}</small></div><span>{fmtSeconds(track.duration)}</span></div>) : <div className="player-queue-empty"><Headphones size={22}/><b>No hay audios reproducibles</b><span>Agrega archivos propios y asígnalos a esta playlist.</span><button onClick={onViewLibrary}>Ir a la biblioteca</button></div>}</div><div className="player-queue-footer"><ListMusic size={15}/>{selection.length} archivos listos para sonar</div></section>
      <section className="panel player-ads-panel"><div className="section-kicker">PAUTAS</div><h2>Cuñas en reproducción</h2><label className="player-check"><input type="checkbox" checked={autoAds} onChange={(e) => setAutoAds(e.target.checked)} /> Poner cuñas en cola al minuto programado</label><p className="player-small-text">Las cuñas empiezan cuando termina la canción en curso. No se interrumpe el audio a mitad de canción.</p>{availableAds.length ? availableAds.map(({campaign,track}) => <button className="player-spot" key={campaign.id} onClick={() => { setPendingAds((old) => [...old,track!.id]); }} disabled={!started}><Megaphone size={17}/><span><b>{campaign.title}</b><small>Agregar siguiente · {track!.duration} s</small></span><Check size={15}/></button>) : <div className="player-small-text">Importa cuñas y activa una campaña para verlas aquí.</div>}{pendingAds.length>0&&<div className="pending-ads">{pendingAds.length} cuña(s) pendiente(s)</div>}</section>
      <section className="panel player-azura-panel"><div className="section-kicker">SERVIDOR DE EMISIÓN</div><div className="azura-header"><Radio size={20}/><h2>AzuraCast</h2><span className={azura?.connected ? "azura-online" : "azura-offline"}>{azura?.connected ? "CONECTADO" : "PENDIENTE"}</span></div>{azura?.connected ? <div className="azura-live"><b>{azura.stationName}</b><span>{azura.isOnline ? "Transmitiendo" : "Estación fuera del aire"}</span><p>{azura.artist} — {azura.song}</p>{typeof azura.listeners === "number" && <small>{azura.listeners} oyentes conectados</small>}{azura.streamUrl && <audio controls src={azura.streamUrl} className="azura-player"/>}</div> : <p className="player-small-text">Configura la URL y el ID de tu emisora como variables seguras del servidor. Aquí aparecerán la canción actual y el enlace de emisión.</p>}</section>
    </aside>
  </div>;
}
