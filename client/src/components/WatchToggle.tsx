export function WatchToggle({
  watched,
  disabled,
  onToggle,
}: {
  watched: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={disabled ? 'Sign in to build a watchlist' : watched ? 'Remove from watchlist' : 'Add to watchlist'}
      aria-pressed={watched}
      aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
      className={`rounded-md border px-2 py-1 text-sm transition-all active:scale-90 ${
        watched ? 'border-amber-500/50 text-amber-300' : 'border-edge text-muted hover:text-white'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {watched ? '★' : '☆'}
    </button>
  );
}
