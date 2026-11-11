import { and, eq } from "drizzle-orm";
import type { StationRepository } from "@/application/ports";
import { nextVersion } from "@/application/station-version";
import { getDb } from "@/db";
import { radioStates } from "@/db/schema";

// One JSON document per user in D1. Replaced by a normalized repository when the station becomes team-shared.
// updated_at doubles as the version for optimistic concurrency, so writes are compare-and-set.
export const d1StationRepository: StationRepository = {
  async load(userId) {
    const [row] = await getDb().select().from(radioStates).where(eq(radioStates.userId, userId)).limit(1);
    return row ? { data: JSON.parse(row.dataJson), updatedAt: row.updatedAt } : null;
  },
  async save(userId, data, expected) {
    const db = getDb();
    const dataJson = JSON.stringify(data);
    const updatedAt = nextVersion(expected);
    const written = expected === undefined
      ? await db.insert(radioStates).values({ userId, dataJson, updatedAt })
        .onConflictDoUpdate({ target: radioStates.userId, set: { dataJson, updatedAt } }).returning({ updatedAt: radioStates.updatedAt })
      : expected === null
        ? await db.insert(radioStates).values({ userId, dataJson, updatedAt }).onConflictDoNothing().returning({ updatedAt: radioStates.updatedAt })
        : await db.update(radioStates).set({ dataJson, updatedAt })
          .where(and(eq(radioStates.userId, userId), eq(radioStates.updatedAt, expected))).returning({ updatedAt: radioStates.updatedAt });
    if (written.length) return { ok: true, updatedAt };
    return { ok: false, current: await this.load(userId) };
  },
};
