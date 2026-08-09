import { colorFromEnum } from '../../logic/colors';
import type { ConsoleColor } from '../../logic/types';

export type ConsolePullRequestStatusBadgesProps = {
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

export const ConsolePullRequestStatusBadges = ({
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
