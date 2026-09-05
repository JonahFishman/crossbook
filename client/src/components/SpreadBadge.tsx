import { useEffect, useRef, useState } from 'react';
import { pct } from '../lib/api';

/**
 * Shows the gap between the two venues' midpoints, and flashes once whenever that
 * value changes between refetches so a live update is visible without a page reload.
 */
export function SpreadBadge({ value }: { value: number | null }) {
  const previous = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (previous.current !== null && value !== null && previous.current !== value) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1100);
      return () => clearTimeout(t);
    }
    previous.current = value;
  }, [value]);

  if (value === null) {
    return <span className="text-sm text-muted">--</span>;
  }

  // Wider disagreement between venues gets progressively more emphasis.
  const tone =
    value >= 0.05
      ? 'border-amber-500/50 text-amber-300'
      : value >= 0.02
        ? 'border-edge text-white'
        : 'border-edge text-muted';

  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-sm font-medium tabular-nums ${tone} ${
        flash ? 'animate-flash' : ''
      }`}
    >
      {pct(value)}
    </span>
  );
}
