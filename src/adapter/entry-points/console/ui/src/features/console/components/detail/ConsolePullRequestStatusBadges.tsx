import { colorFromEnum } from '../../logic/colors';
import type { ConsoleColor, ConsoleMergeableStatus } from '../../logic/types';

export type ConsolePullRequestStatusBadgesProps = {
  mergeableStatus: ConsoleMergeableStatus;
  isPassedAllCiJob: boolean;
  isCiStateSuccess: boolean;
  isBranchOutOfDate: boolean;
  missingRequiredCheckNames: string[];
};

const badgeStyle = (color: ConsoleColor) => {
  const palette = colorFromEnum(color);
  return {
    color: palette.fg,
    borderColor: palette.border,
    backgroundColor: palette.bg,
  };
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

export const ConsolePullRequestStatusBadges = ({
  mergeableStatus,
  isPassedAllCiJob,
  isCiStateSuccess,
  isBranchOutOfDate,
  missingRequiredCheckNames,
}: ConsolePullRequestStatusBadgesProps) => {
  const ciPassing = isPassedAllCiJob && isCiStateSuccess;
  const ciColor: ConsoleColor = ciPassing ? 'GREEN' : 'RED';
  const ciLabel = ciPassing ? 'CI passing' : 'CI failing';
  const missingChecksLabel =
    !ciPassing && missingRequiredCheckNames.length > 0
      ? `missing: ${missingRequiredCheckNames.join(', ')}`
      : null;
  const mergeableBadge = MERGEABLE_BADGE[mergeableStatus];

  return (
    <span className="console-detail-pr-status">
      <span
        className="console-detail-status-chip console-detail-ci-chip"
        style={badgeStyle(ciColor)}
        title={missingChecksLabel ?? ciLabel}
      >
        {ciLabel}
        {missingChecksLabel !== null && (
          <span className="console-detail-ci-missing">
            {' '}
            ({missingChecksLabel})
          </span>
        )}
      </span>
      <span
        className={`console-detail-status-chip console-detail-mergeable-chip ${mergeableBadge.modifier}`}
        style={badgeStyle(mergeableBadge.color)}
        title={mergeableBadge.title}
      >
        {mergeableBadge.label}
      </span>
      {isBranchOutOfDate && (
        <span
          className="console-detail-status-chip console-detail-outofdate-chip"
          style={badgeStyle('YELLOW')}
          title="This branch is out of date with the base branch"
        >
          Out of date
        </span>
      )}
    </span>
  );
};
