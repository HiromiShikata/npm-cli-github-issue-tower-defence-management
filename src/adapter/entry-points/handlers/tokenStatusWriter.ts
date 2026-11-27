import fs from 'fs';
import path from 'path';
import type { Issue } from '../../../domain/entities/Issue';
import { IN_TMUX_STATUS_NAME } from '../../../domain/entities/WorkflowStatus';
import {
  GenerateTokenStatusUseCase,
  SevenDayWindowAggregate,
  TokenRateLimitSnapshot,
  TokenStatus,
  TokenStatusInput,
  computeSevenDayWindowAggregate,
} from '../../../domain/usecases/dashboard/GenerateTokenStatusUseCase';
import { InTmuxByHumanSessionTokenCountUseCase } from '../../../domain/usecases/InTmuxByHumanSessionTokenCountUseCase';
import { OauthTokenCandidate } from '../../../domain/usecases/OauthTokenSelectUseCase';
import { ClaudeInteractiveSessionRepository } from '../../../domain/usecases/adapter-interfaces/ClaudeInteractiveSessionRepository';
import { TakeOwnershipSpawnRepository } from '../../../domain/usecases/adapter-interfaces/TakeOwnershipSpawnRepository';
import { RateLimitSnapshot, readRateLimit } from '../../proxy/RateLimitCache';
import { loadTokenEntries } from '../../proxy/TokenListLoader';
import { ProcClaudeInteractiveSessionRepository } from '../../repositories/ProcClaudeInteractiveSessionRepository';
import { ProcTakeOwnershipSpawnRepository } from '../../repositories/ProcTakeOwnershipSpawnRepository';
import { ProcRunningSubagentFactsRepository } from '../../repositories/ProcRunningSubagentFactsRepository';
import { countRunningSubagentsByWorkerKey } from '../../../domain/usecases/dashboard/CountRunningSubagentsUseCase';

const SEVEN_DAY_SONNET_LIMIT_TYPE = 'seven_day_sonnet';
const SEVEN_DAY_OPUS_LIMIT_TYPE = 'seven_day_opus';

const IN_TMUX_PROJECTS_DIR_NAME = 'token-status-in-tmux';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

type RemoteSubagentCounts = {
  claudeByIssueUrl: Record<string, number>;
  codexByIssueUrl: Record<string, number>;
};

type RemoteSubagentMachine = {
  reachable: boolean;
  subagentCounts: RemoteSubagentCounts | null;
  unmeasuredClaudeIssueUrls: string[];
};

const parseRemoteSubagentMachines = (
  value: unknown,
): RemoteSubagentMachine[] => {
  if (!isRecord(value) || !Array.isArray(value.machines)) return [];
  return value.machines.flatMap((machine): RemoteSubagentMachine[] => {
    if (!isRecord(machine)) return [];
    const subagentCounts = isRecord(machine.subagentCounts)
      ? {
          claudeByIssueUrl: numericRecord(
            machine.subagentCounts.claudeByIssueUrl,
          ),
          codexByIssueUrl: numericRecord(
            machine.subagentCounts.codexByIssueUrl,
          ),
        }
      : null;
    const unmeasuredClaudeIssueUrls = Array.isArray(
      machine.unmeasuredClaudeIssueUrls,
    )
      ? machine.unmeasuredClaudeIssueUrls.filter(
          (key): key is string => typeof key === 'string',
        )
      : [];
    return [
      {
        reachable: machine.reachable === true,
        subagentCounts,
        unmeasuredClaudeIssueUrls,
      },
    ];
  });
};

const numericRecord = (value: unknown): Record<string, number> => {
  if (!isRecord(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'number' && Number.isFinite(entry))
      result[key] = entry;
  }
  return result;
};

export type TokenStatusWriterParams = {
  dashboardDataDir: string | null | undefined;
  tokenListJsonPath: string | null | undefined;
  issues: Issue[];
  pjcode?: string | null | undefined;
  now?: Date;
  readSnapshot?: (token: string) => RateLimitSnapshot | null;
  interactiveSessionRepository?: ClaudeInteractiveSessionRepository;
  spawnRepository?: TakeOwnershipSpawnRepository;
  runningSubagentFactsRepository?: {
    listFacts: () => import('../../../domain/usecases/dashboard/CountRunningSubagentsUseCase').ProcessFact[];
  };
  reportError?: (message: string) => void;
};

export type TokenStatusFile = {
  tokens: TokenStatus[];
  sevenDayWindowAggregate: SevenDayWindowAggregate | null;
  capturedAt: string;
};

type InTmuxByHumanProjectFile = {
  pjcode: string;
  urls: string[];
  capturedAt: string;
};

const writeJsonAtomic = (filePath: string, data: unknown): void => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data));
  fs.renameSync(tmpPath, filePath);
};

const inTmuxByHumanUrlsFromIssues = (issues: Issue[]): string[] => {
  const urls = new Set<string>();
  for (const issue of issues) {
    if (issue.status === IN_TMUX_STATUS_NAME && issue.isClosed === false) {
      urls.add(issue.url);
    }
  }
  return [...urls];
};

const persistProjectInTmuxByHumanUrls = (
  inTmuxProjectsDir: string,
  pjcode: string,
  urls: string[],
  capturedAt: string,
): void => {
  const file: InTmuxByHumanProjectFile = { pjcode, urls, capturedAt };
  writeJsonAtomic(path.join(inTmuxProjectsDir, `${pjcode}.json`), file);
};

const readMachineWideInTmuxByHumanUrls = (
  inTmuxProjectsDir: string,
): Set<string> => {
  const urls = new Set<string>();
  let fileNames: string[];
  try {
    fileNames = fs.readdirSync(inTmuxProjectsDir);
  } catch {
    return urls;
  }
  for (const fileName of fileNames) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(
        fs.readFileSync(path.join(inTmuxProjectsDir, fileName), 'utf8'),
      );
      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        !('urls' in parsed) ||
        !Array.isArray(parsed.urls)
      ) {
        continue;
      }
      for (const url of parsed.urls) {
        if (typeof url === 'string') {
          urls.add(url);
        }
      }
    } catch {
      continue;
    }
  }
  return urls;
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
    lastUpdatedEpoch: snapshot.lastUpdatedEpoch,
    subscriptionDisabled: snapshot.subscriptionDisabled,
  };
};

export const writeTokenStatus = (params: TokenStatusWriterParams): void => {
  const { dashboardDataDir, tokenListJsonPath, issues, pjcode } = params;
  if (!dashboardDataDir || !tokenListJsonPath) {
    return;
  }
  const reportError =
    params.reportError ?? ((message: string) => console.error(message));

  const entries = loadTokenEntries(tokenListJsonPath);
  if (entries === null) {
    return;
  }

  const now = params.now ?? new Date();
  const inTmuxProjectsDir = path.join(
    dashboardDataDir,
    IN_TMUX_PROJECTS_DIR_NAME,
  );
  if (pjcode) {
    persistProjectInTmuxByHumanUrls(
      inTmuxProjectsDir,
      pjcode,
      inTmuxByHumanUrlsFromIssues(issues),
      now.toISOString(),
    );
  }
  const machineWideInTmuxByHumanUrls = pjcode
    ? readMachineWideInTmuxByHumanUrls(inTmuxProjectsDir)
    : new Set(inTmuxByHumanUrlsFromIssues(issues));

  const readSnapshot = params.readSnapshot ?? readRateLimit;
  const interactiveSessionRepository =
    params.interactiveSessionRepository ??
    new ProcClaudeInteractiveSessionRepository();
  const spawnRepository =
    params.spawnRepository ?? new ProcTakeOwnershipSpawnRepository();
  const runningSubagentFactsRepository =
    params.runningSubagentFactsRepository ??
    new ProcRunningSubagentFactsRepository();
  const spawns = spawnRepository.listSpawns();
  const tokensByIssueUrl = new Map<string, Set<string>>();
  for (const spawn of spawns) {
    if (spawn.issueUrl === null) continue;
    const tokens = tokensByIssueUrl.get(spawn.issueUrl) ?? new Set<string>();
    tokens.add(spawn.token);
    tokensByIssueUrl.set(spawn.issueUrl, tokens);
  }
  let subagentCountsMeasured = true;
  let localCounts;
  try {
    localCounts = countRunningSubagentsByWorkerKey(
      runningSubagentFactsRepository.listFacts(),
    );
  } catch (error) {
    reportError(
      `could not read local subagent facts: ${error instanceof Error ? error.message : String(error)}`,
    );
    subagentCountsMeasured = false;
    localCounts = {
      claudeByWorkerKey: new Map<string, number>(),
      codexByWorkerKey: new Map<string, number>(),
      unreadableWorkerPids: [],
      unmeasuredWorkerKeys: [],
    };
  }
  for (const pid of localCounts.unreadableWorkerPids) {
    reportError(`unreadable Claude worker subagent count for pid ${pid}`);
  }
  const unmeasuredTokens = new Set<string>(localCounts.unmeasuredWorkerKeys);
  const claudeCounts = new Map(localCounts.claudeByWorkerKey);
  const codexCounts = new Map(localCounts.codexByWorkerKey);
  const remoteClaudeByIssueUrl = new Map<string, number>();
  const remoteCodexByIssueUrl = new Map<string, number>();
  const remoteUnmeasuredIssueUrls = new Set<string>();
  try {
    const remote: unknown = JSON.parse(
      fs.readFileSync(
        path.join(dashboardDataDir, 'remote-machine-status.json'),
        'utf8',
      ),
    );
    for (const machine of parseRemoteSubagentMachines(remote)) {
      if (
        !machine.reachable ||
        machine.subagentCounts === null ||
        machine.subagentCounts === undefined
      ) {
        subagentCountsMeasured = false;
        continue;
      }
      for (const issueUrl of machine.unmeasuredClaudeIssueUrls)
        remoteUnmeasuredIssueUrls.add(issueUrl);
      for (const [issueUrl, value] of Object.entries(
        machine.subagentCounts.claudeByIssueUrl,
      ))
        remoteClaudeByIssueUrl.set(
          issueUrl,
          (remoteClaudeByIssueUrl.get(issueUrl) ?? 0) + value,
        );
      for (const [issueUrl, value] of Object.entries(
        machine.subagentCounts.codexByIssueUrl,
      ))
        remoteCodexByIssueUrl.set(
          issueUrl,
          (remoteCodexByIssueUrl.get(issueUrl) ?? 0) + value,
        );
    }
  } catch (error) {
    const errorCode =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : null;
    if (errorCode !== 'ENOENT') {
      reportError(
        `could not read remote machine subagent counts: ${error instanceof Error ? error.message : String(error)}`,
      );
      subagentCountsMeasured = false;
    }
  }
  const remoteIssueUrls = new Set<string>([
    ...remoteClaudeByIssueUrl.keys(),
    ...remoteCodexByIssueUrl.keys(),
    ...remoteUnmeasuredIssueUrls,
  ]);
  for (const issueUrl of remoteIssueUrls) {
    const tokens = [...(tokensByIssueUrl.get(issueUrl) ?? [])];
    if (tokens.length !== 1) {
      reportError(
        `remote subagent counts for issue ${issueUrl} match ${tokens.length} local spawns and were not counted`,
      );
      continue;
    }
    const token = tokens[0] ?? '';
    claudeCounts.set(
      token,
      (claudeCounts.get(token) ?? 0) +
        (remoteClaudeByIssueUrl.get(issueUrl) ?? 0),
    );
    codexCounts.set(
      token,
      (codexCounts.get(token) ?? 0) +
        (remoteCodexByIssueUrl.get(issueUrl) ?? 0),
    );
    if (remoteUnmeasuredIssueUrls.has(issueUrl)) unmeasuredTokens.add(token);
  }
  const claudeSubagentCountByToken = new Map(
    entries.map((entry) => [entry.token, claudeCounts.get(entry.token) ?? 0]),
  );
  const codexSubagentCountByToken = new Map(
    entries.map((entry) => [entry.token, codexCounts.get(entry.token) ?? 0]),
  );

  const tokenInputs: TokenStatusInput[] = entries.map((entry) => ({
    name: entry.name,
    token: entry.token,
    snapshot: toTokenRateLimitSnapshot(readSnapshot(entry.token)),
  }));

  const distinctLogPathsByToken = new Map<string, Set<string>>();
  for (const spawn of spawns) {
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
    fableRejected: false,
    blockedUntilEpoch: 0,
  }));
  const machineWideInTmuxByHumanIssues: Issue[] = [
    ...machineWideInTmuxByHumanUrls,
  ].map((url) => ({
    nameWithOwner: '',
    number: 0,
    title: '',
    state: 'OPEN',
    status: IN_TMUX_STATUS_NAME,
    story: null,
    nextActionDate: null,
    nextActionHour: null,
    estimationMinutes: null,
    dependedIssueUrls: [],
    completionDate50PercentConfidence: null,
    url,
    assignees: [],
    labels: [],
    org: '',
    repo: '',
    body: '',
    itemId: '',
    isPr: false,
    isInProgress: false,
    isClosed: false,
    createdAt: now,
    author: '',
    closingIssueReferenceUrls: [],
    plainCrossRepoIssueReferenceUrls: [],
    agent: null,
    stateReason: null,
  }));
  const humResult = new InTmuxByHumanSessionTokenCountUseCase().run(
    candidates,
    interactiveSessionRepository.listInteractiveSessions(),
    machineWideInTmuxByHumanIssues,
  );
  const humCountByToken = new Map<string, number>(
    humResult.counts.map((count) => [count.token, count.count]),
  );

  const tokens = new GenerateTokenStatusUseCase().run({
    tokens: tokenInputs,
    prepCountByToken,
    humCountByToken,
    claudeSubagentCountByToken,
    codexSubagentCountByToken,
    subagentCountsMeasured,
    unmeasuredTokens: new Set(
      entries
        .filter((entry) => unmeasuredTokens.has(entry.token))
        .map((entry) => entry.token),
    ),
    nowEpochSeconds: Math.floor(now.getTime() / 1000),
  });

  const file: TokenStatusFile = {
    tokens,
    sevenDayWindowAggregate: computeSevenDayWindowAggregate(tokens),
    capturedAt: now.toISOString(),
  };

  writeJsonAtomic(path.join(dashboardDataDir, 'token-status.json'), file);
};
