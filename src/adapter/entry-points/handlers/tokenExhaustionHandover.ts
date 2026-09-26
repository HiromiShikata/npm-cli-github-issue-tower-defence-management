import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { TokenExhaustionHandoverUseCase } from '../../../domain/usecases/TokenExhaustionHandoverUseCase';
import { GitHubIssueCheckpointRepository } from '../../repositories/GitHubIssueCheckpointRepository';
import { NodeTmuxSessionRepository } from '../../repositories/NodeTmuxSessionRepository';
import { RateLimitSnapshotRepository } from '../../repositories/RateLimitSnapshotRepository';
import { ProcClaudeHandoverSessionRepository } from '../../repositories/ProcClaudeHandoverSessionRepository';
import { NodeProcessSignalRepository } from '../../repositories/NodeProcessSignalRepository';
import {
  FileHandoverStateRepository,
  defaultHandoverStateFilePath,
} from '../../repositories/FileHandoverStateRepository';

export type TokenExhaustionHandoverParams = {
  enabled: boolean;
  tokenListJsonPath: string | null;
  handoverMessage?: string | null;
  bareNameLeaderHandoverMessage?: string | null;
  tokenRateLimitSnapshotBaseDir?: string | null;
  gracePeriodSeconds?: number | null;
  stateFilePath?: string | null;
  localCommandRunner: LocalCommandRunner;
  now: Date;
};

export const handleTokenExhaustionHandover = async (
  params: TokenExhaustionHandoverParams,
): Promise<void> => {
  const {
    enabled,
    tokenListJsonPath,
    tokenRateLimitSnapshotBaseDir,
    stateFilePath,
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
  const stateRepository = new FileHandoverStateRepository(
    stateFilePath ?? defaultHandoverStateFilePath(),
  );
  const useCase = new TokenExhaustionHandoverUseCase(
    new ProcClaudeHandoverSessionRepository(),
    snapshotRepository,
    new NodeTmuxSessionRepository(localCommandRunner),
    new NodeProcessSignalRepository(),
    new GitHubIssueCheckpointRepository(process.env.GH_TOKEN ?? ''),
  );

  const result = await useCase.run({
    enabled,
    state: stateRepository.load(),
    now,
  });

  stateRepository.save(result.state);
};
