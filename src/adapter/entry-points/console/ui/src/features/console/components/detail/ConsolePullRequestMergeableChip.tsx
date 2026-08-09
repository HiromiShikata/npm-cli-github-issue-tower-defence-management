import { colorFromEnum } from '../../logic/colors';
import type { ConsoleColor, ConsoleMergeableStatus } from '../../logic/types';

export type ConsolePullRequestMergeableChipProps = {
  mergeableStatus: ConsoleMergeableStatus;
};

const MERGEABLE_BADGE: Record<
  ConsoleMergeableStatus,
  { color: ConsoleColor; label: string; title: string; modifier: string }
> = {
  MERGEABLE: {
    color: 'GREEN',
    label: 'No conflict',
    title: 'This pull request has no merge conflicts',
    modifier: 'console-detail-mergeable-chip-ok',
  },
  CONFLICTING: {
    color: 'RED',
    label: 'Conflict',
    title: 'This pull request has merge conflicts',
    modifier: 'console-detail-mergeable-chip-conflict',
  },
  UNKNOWN: {
    color: 'GRAY',
    label: 'Checking merge status',
    title: 'GitHub has not finished computing the merge status yet',
    modifier: 'console-detail-mergeable-chip-unknown',
  },
};

export const ConsolePullRequestMergeableChip = ({
  mergeableStatus,
}: ConsolePullRequestMergeableChipProps) => {
  const badge = MERGEABLE_BADGE[mergeableStatus];
  const palette = colorFromEnum(badge.color);
  return (
    <span
      className={`console-detail-status-chip console-detail-mergeable-chip ${badge.modifier}`}
      style={{
        color: palette.fg,
        borderColor: palette.border,
        backgroundColor: palette.bg,
      }}
      title={badge.title}
    >
      {badge.label}
    </span>
  );
};
