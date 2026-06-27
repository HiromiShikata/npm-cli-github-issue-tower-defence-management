import fs from 'fs';
import path from 'path';
import type { Issue } from '../../../domain/entities/Issue';
import {
  GenerateTokenStatusUseCase,
  TokenRateLimitSnapshot,
  TokenStatus,
  TokenStatusInput,
} from '../../../domain/usecases/dashboard/GenerateTokenStatusUseCase';
import { InTmuxByHumanSessionTokenCountUseCase } from '../../../domain/usecases/InTmuxByHumanSessionTokenCountUseCase';
import { OauthTokenCandidate } from '../../../domain/usecases/OauthTokenSelectUseCase';
import { ClaudeInteractiveSessionRepository } from '../../../domain/usecases/adapter-interfaces/ClaudeInteractiveSessionRepository';
import { TakeOwnershipSpawnRepository } from '../../../domain/usecases/adapter-interfaces/TakeOwnershipSpawnRepository';
import { RateLimitSnapshot, readRateLimit } from '../../proxy/RateLimitCache';
import { loadTokenEntries } from '../../proxy/TokenListLoader';
import { ProcClaudeInteractiveSessionRepository } from '../../repositories/ProcClaudeInteractiveSessionRepository';
import { ProcTakeOwnershipSpawnRepository } from '../../repositories/ProcTakeOwnershipSpawnRepository';

const SEVEN_DAY_SONNET_LIMIT_TYPE = 'seven_day_sonnet';
const SEVEN_DAY_OPUS_LIMIT_TYPE = 'seven_day_opus';

export type TokenStatusWriterParams = {
  dashboardDataDir: string | null | undefined;
  tokenListJsonPath: string | null | undefined;
  issues: Issue[];
  now?: Date;
  readSnapshot?: (token: string) => RateLimitSnapshot | null;
  interactiveSessionRepository?: ClaudeInteractiveSessionRepository;
  spawnRepository?: TakeOwnershipSpawnRepository;
};

export type TokenStatusFile = {
  tokens: TokenStatus[];
  capturedAt: string;
};

const writeJsonAtomic = (filePath: string, data: unknown): void => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data));
  fs.renameSync(tmpPath, filePath);
};

export const toTokenRateLimitSnapshot = (
  snapshot: RateLimitSnapshot | null,
): TokenRateLimitSnapshot | null => {
  if (snapshot === null) {
    return null;
  }
  const hasWindowData =
    snapshot.unifiedStatus !== null ||
    snapshot.fiveHourReset > 0 ||
    snapshot.sevenDayReset > 0 ||
    snapshot.fiveHourUtilization > 0 ||
    snapshot.sevenDayUtilization > 0;
  return {
    fiveHourUtilization: snapshot.fiveHourUtilization,
    fiveHourReset: snapshot.fiveHourReset,
    sevenDayUtilization: snapshot.sevenDayUtilization,
    sevenDayReset: snapshot.sevenDayReset,
    blocked: snapshot.blocked,
    fiveHourRejected: snapshot.fiveHourRejected,
    sevenDayRejected: snapshot.sevenDayRejected,
    unifiedStatus: snapshot.unifiedStatus,
    sevenDaySonnetRejected:
      snapshot.modelWeeklyLimits[SEVEN_DAY_SONNET_LIMIT_TYPE]?.rejected ??
      false,
    sevenDayOpusRejected:
      snapshot.modelWeeklyLimits[SEVEN_DAY_OPUS_LIMIT_TYPE]?.rejected ?? false,
    hasWindowData,
  };
};

export const writeTokenStatus = (params: TokenStatusWriterParams): void => {
  const { dashboardDataDir, tokenListJsonPath, issues } = params;
  if (!dashboardDataDir || !tokenListJsonPath) {
    return;
  }

  const entries = loadTokenEntries(tokenListJsonPath);
  if (entries === null) {
    return;
  }

  const readSnapshot = params.readSnapshot ?? readRateLimit;
  const interactiveSessionRepository =
    params.interactiveSessionRepository ??
    new ProcClaudeInteractiveSessionRepository();
  const spawnRepository =
    params.spawnRepository ?? new ProcTakeOwnershipSpawnRepository();

  const tokenInputs: TokenStatusInput[] = entries.map((entry) => ({
    name: entry.name,
    token: entry.token,
    snapshot: toTokenRateLimitSnapshot(readSnapshot(entry.token)),
  }));

  const distinctLogPathsByToken = new Map<string, Set<string>>();
  for (const spawn of spawnRepository.listSpawns()) {
    const logPaths =
      distinctLogPathsByToken.get(spawn.token) ?? new Set<string>();
    logPaths.add(spawn.logPath);
    distinctLogPathsByToken.set(spawn.token, logPaths);
  }
  const prepCountByToken = new Map<string, number>();
  for (const [token, logPaths] of distinctLogPathsByToken.entries()) {
    prepCountByToken.set(token, logPaths.size);
  }

  const candidates: OauthTokenCandidate[] = entries.map((entry) => ({
    name: entry.name,
    token: entry.token,
    snapshot: null,
    subscriptionDisabled: false,
    unifiedRejected: false,
  }));
  const humResult = new InTmuxByHumanSessionTokenCountUseCase().run(
    candidates,
    interactiveSessionRepository.listInteractiveSessions(),
    issues,
  );
  const humCountByToken = new Map<string, number>(
    humResult.counts.map((count) => [count.token, count.count]),
  );

  const now = params.now ?? new Date();
  const tokens = new GenerateTokenStatusUseCase().run({
    tokens: tokenInputs,
    prepCountByToken,
    humCountByToken,
    nowEpochSeconds: Math.floor(now.getTime() / 1000),
  });

  const file: TokenStatusFile = {
    tokens,
    capturedAt: now.toISOString(),
  };

  writeJsonAtomic(path.join(dashboardDataDir, 'token-status.json'), file);
};
