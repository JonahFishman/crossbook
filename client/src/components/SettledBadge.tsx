/**
 * Marks a topic whose question has already been decided. Its venues have closed, so both
 * prices are settled 0s and 1s rather than forecasts, and the spread between them is
 * meaningless. Shown rather than hidden so the board does not appear to silently lose rows.
 */
export function SettledBadge({ closesAt }: { closesAt: string | null }) {
  const when = closesAt ? new Date(closesAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null;
  return (
    <span
      className="ml-2 inline-block whitespace-nowrap rounded border border-edge px-1.5 py-0.5 align-middle text-[10px] font-medium text-muted"
      title={when ? `Closed ${when}` : 'Closed'}
    >
      settled
    </span>
  );
}
