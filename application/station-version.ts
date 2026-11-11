// Reads the optimistic-concurrency precondition of a station write.
// If-Match: <updatedAt> → must match; If-None-Match: * → must not exist yet; neither → unconditional.
export function expectedVersion(headers: Headers): string | null | undefined {
  const match = headers.get("if-match")?.trim().replace(/^"|"$/g, "");
  if (match) return match;
  if (headers.get("if-none-match")?.trim() === "*") return null;
  return undefined;
}

// A new version must differ from the one it replaces, even within the same millisecond.
export function nextVersion(previous: string | null | undefined, now = new Date()) {
  const next = now.toISOString();
  return next === previous ? new Date(now.getTime() + 1).toISOString() : next;
}
