"use client";

import { useEffect, useRef, useState } from "react";
import { RadioData, seedData } from "@/domain/radio";
import { parseRadioData } from "@/domain/schemas";

export type CloudStatus = "checking" | "cloud" | "local";
export type SyncStatus = "idle" | "saving" | "saved" | "error" | "conflict";
export type StationChange = (updater: (old: RadioData) => RadioData, message?: string) => void;
type Stored = { data: RadioData; updatedAt: string };

const storageKey = "ondapilot-v1";
export const cloneSeed = (): RadioData => structuredClone(seedData);

function readLocal() {
  try {
    const stored = localStorage.getItem(storageKey);
    const parsed = stored ? parseRadioData(JSON.parse(stored)) : null;
    if (parsed) return parsed;
  } catch { /* Keep the demonstration data. */ }
  return cloneSeed();
}

// Writes carry the version the browser last saw; the server answers 409 if someone else saved in between.
function putStation(data: RadioData, version: string | null) {
  return fetch("/api/radio", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(version ? { "If-Match": version } : { "If-None-Match": "*" }) },
    body: JSON.stringify(data),
  });
}

// Station state: the server is the source of truth, localStorage is the offline cache.
export function useStation() {
  const [data, setData] = useState<RadioData>(cloneSeed);
  const [ready, setReady] = useState(false);
  const [cloud, setCloud] = useState<CloudStatus>("checking");
  const [sync, setSync] = useState<SyncStatus>("idle");
  const [conflict, setConflict] = useState<Stored | null>(null);
  const version = useRef<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0);
  const blocked = useRef(false);
  // Set when data came from the server, so the next save effect has nothing to write.
  const skipSave = useRef(false);

  useEffect(() => {
    let canceled = false;
    const initialize = async () => {
      let initial = readLocal();
      let mode: "cloud" | "local" = "local";
      try {
        const response = await fetch("/api/radio", { cache: "no-store" });
        if (response.ok) {
          const result = await response.json() as { exists: boolean; data?: RadioData | null; updatedAt?: string };
          if (result.exists && result.data && result.updatedAt) { initial = result.data; version.current = result.updatedAt; }
          else {
            const saved = await putStation(initial, null);
            if (!saved.ok) throw new Error("initial save failed");
            version.current = (await saved.json() as { updatedAt: string }).updatedAt;
          }
          mode = "cloud";
        }
      } catch { /* Local fallback remains available. */ }
      if (!canceled) { skipSave.current = true; setData(initial); setCloud(mode); setReady(true); }
    };
    void initialize();
    return () => { canceled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storageKey, JSON.stringify(data));
    if (skipSave.current) { skipSave.current = false; return; }
    if (cloud !== "cloud" || conflict) return;
    const current = ++generation.current;
    const timer = window.setTimeout(() => {
      const snapshot = data;
      setSync("saving");
      queue.current = queue.current.then(async () => {
        if (blocked.current) return;
        try {
          const response = await putStation(snapshot, version.current);
          if (response.status === 409) {
            const { current: remote } = await response.json() as { current: Stored | null };
            if (remote) { blocked.current = true; setConflict(remote); setSync("conflict"); return; }
            version.current = null; // Deleted on the server: the next write recreates it.
            throw new Error("station missing");
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          version.current = (await response.json() as { updatedAt: string }).updatedAt;
          if (current === generation.current) setSync("saved");
        } catch { if (current === generation.current) setSync("error"); }
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [data, ready, cloud, conflict]);

  // Conflict resolution: take the server copy, or overwrite it with ours (the save effect re-runs once conflict clears).
  function keepServer() {
    if (!conflict) return;
    version.current = conflict.updatedAt; blocked.current = false; skipSave.current = true;
    setData(conflict.data); setConflict(null); setSync("saved");
  }
  function keepMine() {
    if (!conflict) return;
    version.current = conflict.updatedAt; blocked.current = false;
    setConflict(null);
  }

  return { data, setData, ready, cloud, sync, conflict, keepServer, keepMine };
}
