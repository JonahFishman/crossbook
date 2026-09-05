import { useEffect, useId, useRef, useState } from 'react';

/**
 * Hover and tap are tracked separately. With one `open` boolean, tapping fires a synthetic
 * mouseenter that opens it and then a click that closes it again, so the tip flashed and
 * vanished on exactly the devices that can't hover.
 */
export function InfoTip({ children, label }: { children: React.ReactNode; label: string }) {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const open = hovered || pinned;

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPinned(false);
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [pinned]);

  return (
    <span ref={wrap} className="relative inline-block align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((v) => !v);
        }}
        className="ml-1 h-4 w-4 rounded-full border border-edge text-[10px] leading-none text-muted transition-colors hover:border-muted hover:text-white"
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-6 z-20 w-64 -translate-x-1/2 rounded-md border border-edge bg-panel p-2.5 text-xs leading-relaxed font-normal text-muted shadow-xl"
        >
          {children}
        </span>
      )}
    </span>
  );
}
