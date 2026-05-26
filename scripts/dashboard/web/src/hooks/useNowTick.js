import { useEffect, useState } from 'react';

/**
 * Automatically updates time-based display by returning the current time (ms) every N ms.
 * @param {number} [intervalMs=1000]
 * @returns {number}
 */
export function useNowTick(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
