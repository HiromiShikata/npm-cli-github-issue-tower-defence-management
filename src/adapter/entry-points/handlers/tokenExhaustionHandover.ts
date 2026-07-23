import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import {
  TokenExhaustionHandoverUseCase,
  DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
  DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS,
} from '../../../domain/usecases/TokenExhaustionHandoverUseCase';
import { NodeTmuxSessionRepository } from '../../repositories/NodeTmuxSessionRepository';
import { RateLimitSnapshotRepository } from '../../repositories/RateLimitSnapshotRepository';
import { ProcClaudeInteractiveSessionRepository } from '../../repositories/ProcClaudeInteractiveSessionRepository';

export type TokenExhaustionHandoverParams = {
  enabled: boolean;
  tokenListJsonPath: string | null;
  handoverMessage?: string | null;
  tokenRateLimitSnapshotBaseDir?: string | null;
  gracePeriodSeconds?: number | null;
  localCommandRunner: LocalCommandRunner;
  now: Date;
};

const sentHandoverTimestamps: Map<string, number> = new Map();

export const handleTokenExhaustionHandover = async (
  params: TokenExhaustionHandoverParams,
): Promise<void> => {
  const {
    enabled,
    tokenListJsonPath,
    handoverMessage,
    tokenRateLimitSnapshotBaseDir,
    gracePeriodSeconds,
    localCommandRunner,
    now,
  } = params;

  if (tokenListJsonPath === null) {
    console.log(
      'Token exhaustion handover: skipped (no claudeCodeOauthTokenListJsonPath configured).',
    );
    return;
  }

  const snapshotRepository = new RateLimitSnapshotRepository(
    tokenListJsonPath,
    tokenRateLimitSnapshotBaseDir ?? undefined,
  );
  const useCase = new TokenExhaustionHandoverUseCase(
    new ProcClaudeInteractiveSessionRepository(),
    snapshotRepository,
    new NodeTmuxSessionRepository(localCommandRunner),
  );

  const result = await useCase.run({
    enabled,
    handoverMessage:
      handoverMessage ?? DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
    gracePeriodSeconds:
      gracePeriodSeconds ?? DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS,
    handoverSentAtEpochBySessionName: sentHandoverTimestamps,
    now,
  });

  const nowEpochSeconds = Math.floor(now.getTime() / 1000);
  for (const sessionName of result.newlyHandoverSentSessionNames) {
    sentHandoverTimestamps.set(sessionName, nowEpochSeconds);
  }
  for (const sessionName of result.killedSessionNames) {
    sentHandoverTimestamps.delete(sessionName);
  }
};
