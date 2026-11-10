import { playOrder } from "./radio.ts";

// Booth playback as a pure state machine. Rule: nothing interrupts a song;
// ad spots and schedule changes wait until the current track ends.

export type Lineup = Record<string, { ids: string[]; shuffle: boolean }>;

export type PlayerState = {
  playlistId: string;
  sequence: string[];
  cursor: number;
  adId: string | null;
  pendingAds: string[];
  pendingPlaylistId: string | null;
  started: boolean;
  // Bumped on every track change or restart so the audio element reloads even for the same track.
  nonce: number;
  error: string;
};

export type PlayerEvent =
  | { type: "START"; lineup: Lineup; random?: () => number }
  | { type: "SELECT_PLAYLIST"; playlistId: string }
  | { type: "SCHEDULE_CHANGED"; playlistId: string }
  | { type: "STOP_FOLLOWING_SCHEDULE" }
  | { type: "QUEUE_ADS"; ids: string[] }
  | { type: "ADVANCE"; lineup: Lineup; random?: () => number }
  | { type: "BACK"; elapsedSeconds: number }
  | { type: "FAIL"; message: string };

export type UpNext =
  | { kind: "ad"; id: string }
  | { kind: "switch"; playlistId: string }
  | { kind: "lap" }
  | { kind: "track"; id: string };

export const NO_AUDIO = "Necesitas agregar archivos de audio reales a la playlist seleccionada.";
export const EMPTY_SLOT = "La franja automática no tiene audios cargados. Agrega canciones a su playlist.";

export function initialPlayer(playlistId: string): PlayerState {
  return { playlistId, sequence: [], cursor: 0, adId: null, pendingAds: [], pendingPlaylistId: null, started: false, nonce: 0, error: "" };
}

export function currentTrackId(state: PlayerState) {
  return state.adId || state.sequence[state.cursor] || null;
}

export function upNext(state: PlayerState, lineup: Lineup): UpNext | null {
  if (!state.started) return null;
  if (state.pendingAds.length) return { kind: "ad", id: state.pendingAds[0] };
  if (state.pendingPlaylistId) return { kind: "switch", playlistId: state.pendingPlaylistId };
  if (state.cursor + 1 >= state.sequence.length) return lineup[state.playlistId]?.shuffle ? { kind: "lap" } : state.sequence[0] ? { kind: "track", id: state.sequence[0] } : null;
  return { kind: "track", id: state.sequence[state.cursor + 1] };
}

export function playerReducer(state: PlayerState, event: PlayerEvent): PlayerState {
  switch (event.type) {
    case "START": {
      const playlist = event.lineup[state.playlistId];
      if (!playlist?.ids.length) return { ...state, error: NO_AUDIO };
      return { ...state, sequence: playOrder(playlist.ids, playlist.shuffle, undefined, event.random), cursor: 0, adId: null, pendingAds: [], pendingPlaylistId: null, started: true, nonce: state.nonce + 1, error: "" };
    }
    case "SELECT_PLAYLIST":
      return { ...initialPlayer(event.playlistId), nonce: state.nonce };
    case "SCHEDULE_CHANGED": {
      if (!state.started) return state.playlistId === event.playlistId ? state : { ...state, playlistId: event.playlistId };
      const pendingPlaylistId = event.playlistId === state.playlistId ? null : event.playlistId;
      return pendingPlaylistId === state.pendingPlaylistId ? state : { ...state, pendingPlaylistId };
    }
    case "STOP_FOLLOWING_SCHEDULE":
      return state.pendingPlaylistId ? { ...state, pendingPlaylistId: null } : state;
    case "QUEUE_ADS":
      return event.ids.length ? { ...state, pendingAds: [...state.pendingAds, ...event.ids] } : state;
    case "ADVANCE":
      return advance(state, event.lineup, event.random);
    case "BACK":
      if (!state.started) return state;
      if (state.adId || state.cursor === 0 || event.elapsedSeconds > 3) return { ...state, nonce: state.nonce + 1, error: "" };
      return { ...state, cursor: state.cursor - 1, nonce: state.nonce + 1, error: "" };
    case "FAIL":
      return { ...state, error: event.message };
  }
}

function advance(state: PlayerState, lineup: Lineup, random?: () => number): PlayerState {
  if (!state.started) return state;
  const moved = { ...state, nonce: state.nonce + 1, error: "" };
  if (state.pendingAds.length) return { ...moved, adId: state.pendingAds[0], pendingAds: state.pendingAds.slice(1) };
  const lastId = state.sequence[state.cursor];
  const next = { ...moved, adId: null };
  if (state.pendingPlaylistId) {
    const target = lineup[state.pendingPlaylistId];
    const switched = { ...next, playlistId: state.pendingPlaylistId, pendingPlaylistId: null };
    if (target?.ids.length) return { ...switched, sequence: playOrder(target.ids, target.shuffle, lastId, random), cursor: 0 };
    // The new slot has nothing playable: keep the current music going and say why.
    return continueSequence({ ...switched, error: EMPTY_SLOT }, lineup, lastId, random);
  }
  return continueSequence(next, lineup, lastId, random);
}

function continueSequence(state: PlayerState, lineup: Lineup, lastId: string | undefined, random?: () => number): PlayerState {
  if (!state.sequence.length) return state;
  if (state.cursor + 1 < state.sequence.length) return { ...state, cursor: state.cursor + 1 };
  // A new lap picks up tracks added to the playlist while it was playing.
  const playlist = lineup[state.playlistId];
  const ids = playlist?.ids.length ? playlist.ids : state.sequence;
  return { ...state, sequence: playOrder(ids, Boolean(playlist?.shuffle), lastId, random), cursor: 0 };
}
