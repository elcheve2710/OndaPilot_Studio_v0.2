import { eq } from "drizzle-orm";
import type { StationRepository } from "@/application/ports";
import { getDb } from "@/db";
import { radioStates } from "@/db/schema";

// One JSON document per user in D1. Replaced by a normalized repository when the station becomes team-shared.
export const d1StationRepository: StationRepository = {
  async load(userId) {
    const [row] = await getDb().select().from(radioStates).where(eq(radioStates.userId, userId)).limit(1);
    return row ? { data: JSON.parse(row.dataJson), updatedAt: row.updatedAt } : null;
  },
  async save(userId, data) {
    const dataJson = JSON.stringify(data);
    const updatedAt = new Date().toISOString();
    await getDb().insert(radioStates).values({ userId, dataJson, updatedAt })
      .onConflictDoUpdate({ target: radioStates.userId, set: { dataJson, updatedAt } });
    return updatedAt;
  },
};
