export type ByteRange = { start: number; end: number };

/** Parses a single-range `Range: bytes=` header. Returns null when absent, "invalid" when unsatisfiable. */
export function parseRange(header: string | null, size: number): ByteRange | null | "invalid" {
  if (!header) return null;
  const parsed = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!parsed || (!parsed[1] && !parsed[2])) return "invalid";
  let start: number;
  let end = size - 1;
  if (!parsed[1]) {
    start = Math.max(0, size - Number(parsed[2]));
  } else {
    start = Number(parsed[1]);
    if (parsed[2]) end = Math.min(size - 1, Number(parsed[2]));
  }
  if (start >= size || end < start) return "invalid";
  return { start, end };
}
