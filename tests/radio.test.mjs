import test from "node:test";
import assert from "node:assert/strict";
import { activeBlock, blockDuration, conflicts, dayIndex, seedData, upcomingBlocks, weeklyCoverage } from "../lib/radio.ts";

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

test("orden de próximos bloques", () => {
  const saturdayMorning = new Date("2026-11-07T14:00:00.000Z");
  const next = upcomingBlocks(seedData, saturdayMorning, 2);
  assert.equal(next[0]?.title, "Especial tropical");
  assert.equal(next[1]?.title, "Fin de semana musical");
});
