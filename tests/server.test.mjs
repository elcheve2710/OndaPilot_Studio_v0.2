import test from "node:test";
import assert from "node:assert/strict";
import { parseRange } from "../application/http-range.ts";
import { seedData } from "../domain/radio.ts";
import { parseRadioData } from "../domain/schemas.ts";

test("interpreta cabeceras Range para streaming de audio", () => {
  assert.equal(parseRange(null, 1000), null);
  assert.deepEqual(parseRange("bytes=0-", 1000), { start: 0, end: 999 });
  assert.deepEqual(parseRange("bytes=100-199", 1000), { start: 100, end: 199 });
  assert.deepEqual(parseRange("bytes=900-5000", 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange("bytes=-200", 1000), { start: 800, end: 999 });
  assert.equal(parseRange("bytes=1000-", 1000), "invalid");
  assert.equal(parseRange("bytes=-", 1000), "invalid");
  assert.equal(parseRange("items=0-1", 1000), "invalid");
});

test("el esquema acepta la programación de ejemplo y conserva campos opcionales", () => {
  const parsed = parseRadioData(structuredClone(seedData));
  assert.ok(parsed);
  assert.equal(parsed.tracks[0].artist, "Audio de ejemplo");
  assert.equal(parsed.playlists[0].color, "#33d6bb");
});

test("el esquema rechaza datos inválidos", () => {
  assert.equal(parseRadioData(null), null);
  assert.equal(parseRadioData({ ...seedData, station: "x".repeat(161) }), null);
  assert.equal(parseRadioData({ ...seedData, blocks: [{ id: "b", day: 7, start: "06:00", end: "07:00", playlistId: "p1" }] }), null);
  assert.equal(parseRadioData({ ...seedData, blocks: [{ id: "b", day: 0, start: "6:00", end: "07:00", playlistId: "p1" }] }), null);
  assert.equal(parseRadioData({ ...seedData, tracks: [{ id: "t", title: "x", duration: 1, kind: "jingle" }] }), null);
});

test("la precondición de versión se lee de If-Match / If-None-Match", async () => {
  const { expectedVersion, nextVersion } = await import("../application/station-version.ts");
  assert.equal(expectedVersion(new Headers({ "If-Match": "\"2026-11-10T10:00:00.000Z\"" })), "2026-11-10T10:00:00.000Z");
  assert.equal(expectedVersion(new Headers({ "If-None-Match": "*" })), null);
  assert.equal(expectedVersion(new Headers()), undefined);
  const now = new Date("2026-11-10T10:00:00.000Z");
  assert.notEqual(nextVersion(now.toISOString(), now), now.toISOString());
});
