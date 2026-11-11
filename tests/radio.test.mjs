import test from "node:test";
import assert from "node:assert/strict";
import { activeBlock, blockDuration, conflicts, dayIndex, fallbackPlaylist, playOrder, removePlaylist, removeTrack, scheduledPlaylistId, seedData, shuffled, upcomingBlocks, weeklyCoverage } from "../domain/radio.ts";

const make = (day, start, end) => ({ id: `${day}-${start}-${end}`, title: "Prueba", day, start, end, playlistId: "p1" });

test("la cobertura inicial se calcula con la unión de franjas", () => {
  assert.equal(weeklyCoverage(seedData), 50);
  assert.equal(weeklyCoverage({ ...seedData, blocks: [] }), 0);
});

test("detecta cruces dentro de un mismo día", () => {
  const existing = [make(0, "09:00", "13:00")];
  assert.equal(conflicts(make(0, "12:30", "14:00"), existing).length, 1);
  assert.equal(conflicts(make(0, "13:00", "14:00"), existing).length, 0);
});

test("detecta franjas que atraviesan medianoche", () => {
  const overnight = make(5, "23:00", "02:00");
  assert.equal(blockDuration(overnight), 180);
  assert.equal(conflicts(make(6, "01:00", "03:00"), [overnight]).length, 1);
  assert.equal(conflicts(make(6, "03:00", "04:00"), [overnight]).length, 0);
});

test("detecta el salto de domingo a lunes", () => {
  const sunday = make(6, "23:00", "01:00");
  assert.equal(conflicts(make(0, "00:30", "02:00"), [sunday]).length, 1);
});

test("las horas de programación respetan America/Bogota", () => {
  const saturdayMorning = new Date("2026-11-07T14:00:00.000Z");
  assert.equal(dayIndex(saturdayMorning), 5);
  assert.equal(activeBlock(seedData, saturdayMorning)?.title, "Fin de semana musical");
  const sundayAtDawn = new Date("2026-11-08T12:00:00.000Z");
  assert.equal(activeBlock(seedData, sundayAtDawn), undefined);
});

test("el modo aleatorio conserva todas las pistas sin repetir", () => {
  const ids = ["a", "b", "c", "d", "e"];
  for (let run = 0; run < 50; run++) assert.deepEqual([...shuffled(ids)].sort(), ids);
  assert.deepEqual(playOrder(ids, false, "e"), ids);
});

test("una nueva vuelta aleatoria no repite la última canción", () => {
  const ids = ["a", "b", "c"];
  const alwaysLast = () => 0.999;
  assert.deepEqual(shuffled(ids, alwaysLast), ["a", "b", "c"]);
  assert.equal(playOrder(ids, true, "a", alwaysLast)[0], "b");
  for (let run = 0; run < 50; run++) assert.notEqual(playOrder(ids, true, "b")[0], "b");
  assert.deepEqual(playOrder(["solo"], true, "solo"), ["solo"]);
});

test("orden de próximos bloques", () => {
  const saturdayMorning = new Date("2026-11-07T14:00:00.000Z");
  const next = upcomingBlocks(seedData, saturdayMorning, 2);
  assert.equal(next[0]?.title, "Especial tropical");
  assert.equal(next[1]?.title, "Fin de semana musical");
});

test("la playlist de respaldo es la configurada aunque cambie de nombre", () => {
  const data = { ...seedData, playlists: seedData.playlists.map((p) => p.id === "p4" ? { ...p, name: "Madrugada" } : p) };
  assert.equal(fallbackPlaylist(data).id, "p4");
  assert.equal(fallbackPlaylist({ ...data, fallbackPlaylistId: "p2" }).id, "p2");
});

test("sin respaldo configurado se usa la rotación y luego la primera playlist", () => {
  assert.equal(fallbackPlaylist({ ...seedData, fallbackPlaylistId: undefined }).id, "p4");
  assert.equal(fallbackPlaylist({ ...seedData, fallbackPlaylistId: "borrada", playlists: seedData.playlists.slice(0, 2) }).id, "p1");
});

test("fuera de franja suena el respaldo y dentro la playlist del bloque", () => {
  assert.equal(scheduledPlaylistId(seedData, new Date("2026-05-18T13:00:00Z")), "p1"); // lunes 08:00 Bogotá
  assert.equal(scheduledPlaylistId(seedData, new Date("2026-05-18T16:00:00Z")), "p4"); // lunes 11:00, hueco
});

test("eliminar la playlist de respaldo quita sus bloques y el respaldo", () => {
  const after = removePlaylist(seedData, "p4");
  assert.equal(after.fallbackPlaylistId, undefined);
  assert.ok(after.playlists.every((p) => p.id !== "p4"));
  const kept = removePlaylist(seedData, "p1");
  assert.equal(kept.fallbackPlaylistId, "p4");
  assert.ok(kept.blocks.every((b) => b.playlistId !== "p1"));
});

test("eliminar una pista la quita de playlists y borra campañas que la usaban", () => {
  const after = removeTrack(seedData, "ad1");
  assert.ok(after.campaigns.every((c) => c.trackId !== "ad1"));
  const music = removeTrack(seedData, "t1");
  assert.ok(music.playlists.every((p) => !p.trackIds.includes("t1")));
  assert.equal(music.tracks.length, seedData.tracks.length - 1);
});
