import React from 'react';
import { useCountUp } from '../hooks/useCountUp.js';

/**
 * A number (text node) that counts up from 0 → value. Used in DOM context.
 *
 * @param {{ value: number, duration?: number }} props
 */
export default function CountUp({ value, duration = 900 }) {
  const n = useCountUp(value, duration);
  return <>{n}</>;
}
