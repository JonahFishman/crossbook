import { InfoTip } from './InfoTip';

/**
 * Marks a topic whose two markets do not share resolution criteria. Without this the
 * board silently presents the widest spread on the page as the biggest opportunity,
 * when part of that gap is definitional rather than the venues disagreeing.
 */
export function MatchBadge() {
  return (
    <span className="ml-2 inline-flex items-center whitespace-nowrap rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 align-middle">
      criteria differ
      <InfoTip label="Why these criteria differ">
        These two markets are close but not identical, so part of the spread is definitional
        rather than the venues disagreeing. The gross edge is not meaningful here. The topic
        page explains exactly how they differ.
      </InfoTip>
    </span>
  );
}
