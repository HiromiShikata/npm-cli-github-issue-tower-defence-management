import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import {
  DEFAULT_GRACE_PERIOD_SECONDS,
  DEFAULT_HANDOVER_MESSAGE,
  DEFAULT_RATE_LIMIT_STALE_THRESHOLD_SECONDS,
  TokenExhaustionHandoverUseCase,
} from '../../../domain/usecases/intmux/TokenExhaustionHandoverUseCase';
import { NodeTmuxSessionRepository } from '../../repositories/NodeTmuxSessionRepository';
import { ProcClaudeInteractiveSessionRepository } from '../../repositories/ProcClaudeInteractiveSessionRepository';
import { RateLimitSnapshotRepository } from '../../repositories/RateLimitSnapshotRepository';

const sentHandoverTimestamps = new Map<string, number>();

export type HandleTokenExhaustionHandoverParams = {
  enabled: boolean;
  localCommandRunner: LocalCommandRunner;
  handoverMessageText: string;
  gracePeriodSeconds: number;
  rateLimitStaleThresholdSeconds: number;
  tokenRateLimitSnapshotBaseDir: string | null;
  nowEpochSeconds: number;
};

export const handleTokenExhaustionHandover = async (
  params: HandleTokenExhaustionHandoverParams,
): Promise<void> => {
  const {
    enabled,
    localCommandRunner,
    handoverMessageText,
    gracePeriodSeconds,
    rateLimitStaleThresholdSeconds,
    tokenRateLimitSnapshotBaseDir,
    nowEpochSeconds,
  } = params;

  const useCase = new TokenExhaustionHandoverUseCase(
    new ProcClaudeInteractiveSessionRepository(),
    tokenRateLimitSnapshotBaseDir !== null
      ? new RateLimitSnapshotRepository(tokenRateLimitSnapshotBaseDir)
      : new RateLimitSnapshotRepository(),
    new NodeTmuxSessionRepository(localCommandRunner),
  );

  const result = await useCase.run({
    nowEpochSeconds,
    handoverMessageText,
    gracePeriodSeconds,
    rateLimitStaleThresholdSeconds,
    dryRun: !enabled,
    sentHandoverTimestamps,
  });

  if (result.handoverInitiatedIssueUrls.length > 0) {
    console.log(
      `Token exhaustion handover initiated for: ${result.handoverInitiatedIssueUrls.join(', ')}`,
    );
  }
  if (result.killedIssueUrls.length > 0) {
    console.log(
      `Token exhaustion: killed sessions after grace period: ${result.killedIssueUrls.join(', ')}`,
    );
  }
};

export const DEFAULT_HANDLE_TOKEN_EXHAUSTION_HANDOVER_PARAMS: Pick<
  HandleTokenExhaustionHandoverParams,
  | 'handoverMessageText'
  | 'gracePeriodSeconds'
  | 'rateLimitStaleThresholdSeconds'
> = {
  handoverMessageText: DEFAULT_HANDOVER_MESSAGE,
  gracePeriodSeconds: DEFAULT_GRACE_PERIOD_SECONDS,
  rateLimitStaleThresholdSeconds: DEFAULT_RATE_LIMIT_STALE_THRESHOLD_SECONDS,
};
