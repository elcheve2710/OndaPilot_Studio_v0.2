import test from "node:test";
import assert from "node:assert/strict";
import { currentTrackId, EMPTY_SLOT, initialPlayer, NO_AUDIO, playerReducer, upNext } from "../domain/player.ts";

const lineup = {
  morning: { ids: ["m1", "m2", "m3"], shuffle: false },
  night: { ids: ["n1", "n2"], shuffle: false },
  mix: { ids: ["x1", "x2", "x3"], shuffle: true },
  empty: { ids: [], shuffle: false },
};
const run = (state, ...events) => events.reduce(playerReducer, state);
const started = (playlistId = "morning") => run(initialPlayer(playlistId), { type: "START", lineup });
const next = { type: "ADVANCE", lineup };

test("no arranca sin audios reproducibles", () => {
  const state = run(initialPlayer("empty"), { type: "START", lineup });
  assert.equal(state.started, false);
  assert.equal(state.error, NO_AUDIO);
});

test("avanza en orden y vuelve a empezar al final", () => {
  const state = started();
  assert.equal(currentTrackId(state), "m1");
  assert.equal(currentTrackId(run(state, next, next)), "m3");
  assert.equal(currentTrackId(run(state, next, next, next)), "m1");
});

test("las cuñas suenan al terminar la canción y luego sigue la música", () => {
  let state = run(started(), { type: "QUEUE_ADS", ids: ["ad1", "ad2"] });
  assert.equal(currentTrackId(state), "m1", "la cuña no interrumpe");
  assert.deepEqual(upNext(state, lineup), { kind: "ad", id: "ad1" });
  state = run(state, next);
  assert.equal(currentTrackId(state), "ad1");
  state = run(state, next);
  assert.equal(currentTrackId(state), "ad2");
  state = run(state, next);
  assert.equal(currentTrackId(state), "m2");
});

test("el cambio de franja espera a que termine la canción", () => {
  let state = run(started(), { type: "SCHEDULE_CHANGED", playlistId: "night" });
  assert.equal(currentTrackId(state), "m1");
  assert.equal(state.playlistId, "morning");
  assert.deepEqual(upNext(state, lineup), { kind: "switch", playlistId: "night" });
  state = run(state, next);
  assert.equal(state.playlistId, "night");
  assert.equal(currentTrackId(state), "n1");
  assert.equal(state.pendingPlaylistId, null);
});

test("si la parrilla vuelve a la franja actual se cancela el cambio pendiente", () => {
  const state = run(started(), { type: "SCHEDULE_CHANGED", playlistId: "night" }, { type: "SCHEDULE_CHANGED", playlistId: "morning" });
  assert.equal(state.pendingPlaylistId, null);
});

test("sin reproducir, la parrilla cambia la playlist de inmediato", () => {
  const state = run(initialPlayer("morning"), { type: "SCHEDULE_CHANGED", playlistId: "night" });
  assert.equal(state.playlistId, "night");
  assert.equal(state.started, false);
});

test("una franja sin audios avisa y mantiene la música", () => {
  const state = run(started(), { type: "SCHEDULE_CHANGED", playlistId: "empty" }, next);
  assert.equal(state.error, EMPTY_SLOT);
  assert.equal(currentTrackId(state), "m2");
});

test("anterior reinicia la canción o vuelve a la previa", () => {
  const second = run(started(), next);
  const restarted = run(second, { type: "BACK", elapsedSeconds: 30 });
  assert.equal(currentTrackId(restarted), "m2");
  assert.equal(restarted.nonce, second.nonce + 1, "recarga el audio para empezar de cero");
  assert.equal(currentTrackId(run(second, { type: "BACK", elapsedSeconds: 1 })), "m1");
  assert.equal(currentTrackId(run(started(), { type: "BACK", elapsedSeconds: 0 })), "m1");
});

test("una nueva vuelta incluye canciones agregadas mientras sonaba", () => {
  const grown = { ...lineup, night: { ids: ["n1", "n2", "n3"], shuffle: false } };
  const state = run(started("night"), next, { type: "ADVANCE", lineup: grown });
  assert.deepEqual(state.sequence, ["n1", "n2", "n3"]);
  assert.equal(currentTrackId(state), "n1");
});

test("en aleatorio anuncia una nueva vuelta en lugar de una canción fija", () => {
  const state = run(started("mix"), next, next);
  assert.deepEqual(upNext(state, lineup), { kind: "lap" });
});

test("elegir otra playlist detiene la cabina", () => {
  const state = run(started(), { type: "QUEUE_ADS", ids: ["ad1"] }, { type: "SELECT_PLAYLIST", playlistId: "night" });
  assert.equal(state.started, false);
  assert.equal(state.playlistId, "night");
  assert.deepEqual(state.pendingAds, []);
  assert.equal(currentTrackId(state), null);
});

test("avanzar o retroceder sin haber iniciado no hace nada", () => {
  const idle = initialPlayer("morning");
  assert.equal(run(idle, next), idle);
  assert.equal(run(idle, { type: "BACK", elapsedSeconds: 0 }), idle);
});
