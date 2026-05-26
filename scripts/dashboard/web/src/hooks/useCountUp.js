import { useEffect, useState } from 'react';

const prefersReduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Returns an integer that increases smoothly from 0 → target.
 * If the target changes, animation starts from 0 again. If it is reduced-motion, target immediately.
 *
 * @param {number} target
 * @param {number} [duration] ms
 * @returns {number}
 */
export function useCountUp(target, duration = 900) {
  const end = Number.isFinite(target) ? target : 0;
  const [val, setVal] = useState(prefersReduced ? end : 0);

  useEffect(() => {
    if (prefersReduced || duration <= 0) {
      setVal(end);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(end * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setVal(end);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, duration]);

  return Math.round(val);
}
