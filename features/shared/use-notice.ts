"use client";

import { useEffect, useState } from "react";

export function useNotice() {
  const [notice, setNotice] = useState("");
  useEffect(() => { if (notice) { const t = window.setTimeout(() => setNotice(""), 4000); return () => window.clearTimeout(t); } }, [notice]);
  return [notice, setNotice] as const;
}
