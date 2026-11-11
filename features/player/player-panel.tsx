"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AlertCircle, AudioLines, Check, Clock3, Headphones, ListMusic, Megaphone, Pause, Play, Radio, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { currentTrackId, initialPlayer, Lineup, playerReducer, upNext } from "@/domain/player";
import { fallbackPlaylist, fmtSeconds, RadioData, scheduledPlaylistId, Track } from "@/domain/radio";
import { loadAudio } from "@/infrastructure/browser/local-media";

type AzuraState = { configured: boolean; connected: boolean; isOnline?: boolean; stationName?: string; song?: string | null; artist?: string | null; listeners?: number | null; streamUrl?: string | null; error?: string };

function playable(track: Track | undefined): track is Track { return Boolean(track?.uploaded); }
function currentMinuteInColombia() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", hourCycle: "h23", hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const val = (key: string) => parts.find((part) => part.type === key)?.value || "00";
  return { stamp: `${val("year")}-${val("month")}-${val("day")} ${val("hour")}:${val("minute")}`, minute: Number(val("minute")) };
}

export function PlayerPanel({ data, onViewLibrary }: { data: RadioData; onViewLibrary: () => void }) {
  const [state, dispatch] = useReducer(playerReducer, undefined, () => initialPlayer(scheduledPlaylistId(data, new Date()) || ""));
  const [paused, setPaused] = useState(false);
  const [localSource, setLocalSource] = useState<{ key: string; url: string } | null>(null);
  const [autoAds, setAutoAds] = useState(false);
  const [followSchedule, setFollowSchedule] = useState(false);
  const [azura, setAzura] = useState<AzuraState | null>(null);
  const fired = useRef(new Set<string>());
  const audio = useRef<HTMLAudioElement>(null);

  const lineup = useMemo<Lineup>(() => Object.fromEntries(data.playlists.map((p) => [p.id, { ids: p.trackIds.filter((id) => playable(data.tracks.find((t) => t.id === id))), shuffle: p.shuffle }])), [data.playlists, data.tracks]);
  const trackById = (id: string) => data.tracks.find((t) => t.id === id);
  const selection = (lineup[state.playlistId]?.ids || []).map(trackById).filter(playable);
  const current = data.tracks.find((t) => t.id === currentTrackId(state));
  const { started } = state;
  const isSpot = current?.kind === "ad";
  const availableAds = data.campaigns.map((campaign) => ({ campaign, track: trackById(campaign.trackId) })).filter((x) => x.campaign.enabled && playable(x.track));
  const pendingPlaylist = data.playlists.find((p) => p.id === state.pendingPlaylistId);
  const fallback = fallbackPlaylist(data);
  const coming = upNext(state, lineup);
  const comingLabel = !coming ? null
    : coming.kind === "ad" ? `Cuña · ${trackById(coming.id)?.title}`
    : coming.kind === "switch" ? `Cambio de franja · ${data.playlists.find((p) => p.id === coming.playlistId)?.name}`
    : coming.kind === "lap" ? "Nueva vuelta aleatoria de la playlist"
    : trackById(coming.id)?.title;

  // Cloud audio streams straight from the API; browser-only audio is read from IndexedDB per track change.
  const sourceKey = started && current ? `${current.id}:${state.nonce}` : null;
  const currentId = current?.id;
  const currentStorage = current?.storage;
  const currentTitle = current?.title;
  const source = !sourceKey || !currentId ? null
    : currentStorage === "cloud" ? `/api/audio?id=${encodeURIComponent(currentId)}`
    : localSource?.key === sourceKey ? localSource.url : null;

  useEffect(() => {
    if (!sourceKey || !currentId || currentStorage === "cloud") return;
    let canceled = false;
    let objectUrl: string | null = null;
    loadAudio(currentId).then((blob) => {
      if (!blob) throw new Error("Audio no encontrado en este navegador");
      objectUrl = URL.createObjectURL(blob);
      if (!canceled) setLocalSource({ key: sourceKey, url: objectUrl });
    }).catch(() => { if (!canceled) { dispatch({ type: "FAIL", message: `El archivo «${currentTitle}» ya no está disponible.` }); setPaused(true); } });
    return () => { canceled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [sourceKey, currentId, currentStorage, currentTitle]);

  useEffect(() => {
    if (!followSchedule) return;
    const update = () => {
      const nextId = scheduledPlaylistId(data, new Date());
      if (nextId) dispatch({ type: "SCHEDULE_CHANGED", playlistId: nextId });
    };
    update();
    const timer = window.setInterval(update, 15000);
    return () => window.clearInterval(timer);
  }, [followSchedule, data]);

  useEffect(() => {
    let canceled = false;
    fetch("/api/azuracast", { cache: "no-store" }).then(async (r) => await r.json() as AzuraState).then((result) => { if (!canceled) setAzura(result); }).catch(() => { if (!canceled) setAzura({ configured: false, connected: false }); });
    return () => { canceled = true; };
  }, []);

  useEffect(() => {
    if (!autoAds || !started) return;
    const check = () => {
      const clock = currentMinuteInColombia();
      const ids: string[] = [];
      for (const campaign of data.campaigns) {
        const track = data.tracks.find((t) => t.id === campaign.trackId);
        const fireKey = `${clock.stamp}:${campaign.id}`;
        if (!campaign.enabled || !playable(track) || !campaign.minuteSlots.includes(clock.minute) || fired.current.has(fireKey)) continue;
        fired.current.add(fireKey);
        ids.push(track.id);
      }
      dispatch({ type: "QUEUE_ADS", ids });
      if (fired.current.size > 1000) fired.current.clear();
    };
    const timer = window.setInterval(check, 10000);
    check();
    return () => window.clearInterval(timer);
  }, [autoAds, started, data.campaigns, data.tracks]);

  function begin() { dispatch({ type: "START", lineup }); setPaused(false); }
  function advance() { dispatch({ type: "ADVANCE", lineup }); setPaused(false); }
  function back() { dispatch({ type: "BACK", elapsedSeconds: audio.current?.currentTime || 0 }); setPaused(false); }
  function togglePause() {
    if (!audio.current) return;
    if (audio.current.paused) { void audio.current.play().catch(() => dispatch({ type: "FAIL", message: "Pulsa reproducir para permitir audio en este navegador." })); }
    else audio.current.pause();
  }

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
        <div className="player-controls"><button className="player-control-secondary" disabled={!started} onClick={back} aria-label="Reiniciar o volver a la canción anterior"><SkipBack size={22}/></button><button className="player-control-main" aria-label={started && !paused ? "Pausar reproducción" : "Iniciar o reanudar reproducción"} onClick={started ? togglePause : begin}>{started && !paused ? <Pause size={26} fill="currentColor"/> : <Play size={26} fill="currentColor"/>}</button><button className="player-control-secondary" disabled={!started} onClick={advance} aria-label="Siguiente canción"><SkipForward size={22}/></button></div>
        {source && <audio ref={audio} key={`${source}-${state.nonce}`} src={source} autoPlay onCanPlay={() => { void audio.current?.play().catch(() => dispatch({ type: "FAIL", message: "El navegador bloqueó el inicio automático. Pulsa reproducir." })); }} onEnded={advance} onPlay={() => setPaused(false)} onPause={() => setPaused(true)} onError={() => dispatch({ type: "FAIL", message: "No fue posible reproducir este formato o archivo." })} controls className="player-native-audio" />}
        {comingLabel && <div className="player-up-next"><Clock3 size={13}/><span>A continuación: <b>{comingLabel}</b></span></div>}
        {state.error && <div className="player-error"><AlertCircle size={16}/>{state.error}</div>}
        <div className="player-source-info"><Volume2 size={16}/><span>Salida de audio: este dispositivo</span><span className="player-tiny-dot"/> <span>Sin transmisión pública</span></div>
      </div>
      <div className="playback-note"><AlertCircle size={17}/><span>Esta cabina sí reproduce audio, pero <b>no es un servidor 24/7</b>. Si cierras la pestaña, se detiene. Para oyentes externos necesitaremos conectar AzuraCast.</span></div>
    </section>
    <aside className="player-side">
      <section className="panel player-queue-panel"><div className="section-kicker">COLA MUSICAL</div><h2>¿Qué sonará?</h2><label className="player-select-label">Playlist<select value={state.playlistId} disabled={followSchedule} onChange={(e) => { dispatch({ type: "SELECT_PLAYLIST", playlistId: e.target.value }); setPaused(false); }}>{data.playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select></label><label className="player-check"><input type="checkbox" checked={followSchedule} onChange={(e) => { setFollowSchedule(e.target.checked); if (!e.target.checked) dispatch({ type: "STOP_FOLLOWING_SCHEDULE" }); }} /> Seguir automáticamente la parrilla semanal</label><p className="player-small-text">Al cambiar de franja se carga su playlist cuando termina la canción en curso. En horarios libres suena la playlist de respaldo{fallback ? ` («${fallback.name}»)` : ""}.</p>{pendingPlaylist && <div className="pending-ads">Cambiará a «{pendingPlaylist.name}» al terminar la canción</div>}<div className="player-queue-list">{selection.length ? selection.map((track, i) => <div key={track.id} className={`player-queue-item ${track.id === current?.id && !isSpot ? "playing" : ""}`}><span className="player-queue-number">{String(i+1).padStart(2,"0")}</span><div><b>{track.title}</b><small>{track.artist}</small></div><span>{fmtSeconds(track.duration)}</span></div>) : <div className="player-queue-empty"><Headphones size={22}/><b>No hay audios reproducibles</b><span>Agrega archivos propios y asígnalos a esta playlist.</span><button onClick={onViewLibrary}>Ir a la biblioteca</button></div>}</div><div className="player-queue-footer"><ListMusic size={15}/>{selection.length} archivos listos para sonar</div></section>
      <section className="panel player-ads-panel"><div className="section-kicker">PAUTAS</div><h2>Cuñas en reproducción</h2><label className="player-check"><input type="checkbox" checked={autoAds} onChange={(e) => setAutoAds(e.target.checked)} /> Poner cuñas en cola al minuto programado</label><p className="player-small-text">Las cuñas empiezan cuando termina la canción en curso. No se interrumpe el audio a mitad de canción.</p>{availableAds.length ? availableAds.map(({campaign,track}) => <button className="player-spot" key={campaign.id} onClick={() => dispatch({ type: "QUEUE_ADS", ids: [track!.id] })} disabled={!started}><Megaphone size={17}/><span><b>{campaign.title}</b><small>Agregar siguiente · {track!.duration} s</small></span><Check size={15}/></button>) : <div className="player-small-text">Importa cuñas y activa una campaña para verlas aquí.</div>}{state.pendingAds.length>0&&<div className="pending-ads">{state.pendingAds.length} cuña(s) pendiente(s)</div>}</section>
      <section className="panel player-azura-panel"><div className="section-kicker">SERVIDOR DE EMISIÓN</div><div className="azura-header"><Radio size={20}/><h2>AzuraCast</h2><span className={azura?.connected ? "azura-online" : "azura-offline"}>{azura?.connected ? "CONECTADO" : "PENDIENTE"}</span></div>{azura?.connected ? <div className="azura-live"><b>{azura.stationName}</b><span>{azura.isOnline ? "Transmitiendo" : "Estación fuera del aire"}</span><p>{azura.artist} — {azura.song}</p>{typeof azura.listeners === "number" && <small>{azura.listeners} oyentes conectados</small>}{azura.streamUrl && <audio controls src={azura.streamUrl} className="azura-player"/>}</div> : <p className="player-small-text">Configura la URL y el ID de tu emisora como variables seguras del servidor. Aquí aparecerán la canción actual y el enlace de emisión.</p>}</section>
    </aside>
  </div>;
}
