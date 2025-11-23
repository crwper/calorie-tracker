// hooks/useStickyBoolean.ts
'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Keeps a boolean "visible" for at least minOnMs after it flips from true -> false.
 * Useful for non-jittery "Saving…" indicators.
 */
export default function useStickyBoolean(on: boolean, minOnMs = 250) {
  const [vis, setVis] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (on) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      setVis(true);
    } else {
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setVis(false);
        timer.current = null;
      }, minOnMs);
    }
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [on, minOnMs]);

  return vis;
}
