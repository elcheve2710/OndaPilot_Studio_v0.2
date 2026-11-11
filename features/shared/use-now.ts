"use client";

import { useEffect, useState } from "react";

// Stable server/client first render (epoch), then the visitor's clock, refreshed every 30 s.
export function useNow() {
  const [now, setNow] = useState(() => new Date(0));
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);
  return now;
}
