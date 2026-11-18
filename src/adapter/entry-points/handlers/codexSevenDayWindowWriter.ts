import * as fs from 'fs';
import * as path from 'path';
import {
  CodexRolloutRateLimitReadResult,
  CodexRolloutRateLimitRepository,
} from '../../../domain/usecases/adapter-interfaces/CodexRolloutRateLimitRepository';
import {
  CODEX_SEVEN_DAY_WINDOW_DIR_NAME,
  CodexSevenDayWindowStatus,
} from '../../../domain/usecases/dashboard/CodexSevenDayWindowUseCase';

const DEFAULT_CODEX_HOME_NAME = '.codex';

export type CodexSevenDayWindowFile = {
  capturedAt: string;
  windows: CodexSevenDayWindowStatus[];
};

export type CodexHomeReference = {
  label: string;
  directory: string;
};

export const resolveCodexHomeReferences = (params: {
  codexHomeCandidates: string[] | null | undefined;
  codexHomeEnv: string | undefined;
  homeDirectory: string;
}): CodexHomeReference[] => {
  const candidates = params.codexHomeCandidates ?? [];
  if (candidates.length > 0) {
    return candidates.map((name) => ({
      label: name,
      directory: path.join(params.homeDirectory, name),
    }));
  }
  if (params.codexHomeEnv) {
    return [
      {
        label: path.basename(params.codexHomeEnv),
        directory: params.codexHomeEnv,
      },
    ];
  }
  return [
    {
      label: DEFAULT_CODEX_HOME_NAME,
      directory: path.join(params.homeDirectory, DEFAULT_CODEX_HOME_NAME),
    },
  ];
};

const toWindowStatus = (
  label: string,
  result: CodexRolloutRateLimitReadResult,
): CodexSevenDayWindowStatus => {
  if (result.observation !== null) {
    return {
      codexHome: label,
      state: 'observed',
      usedPercent: result.observation.usedPercent,
      resetsAtEpochSeconds: result.observation.resetsAtEpochSeconds,
      capturedAt: result.observation.capturedAt,
      errorMessage: null,
    };
  }
  const hasErrors = result.errorMessages.length > 0;
  return {
    codexHome: label,
    state: hasErrors ? 'error' : 'no-data',
    usedPercent: null,
    resetsAtEpochSeconds: null,
    capturedAt: null,
    errorMessage: hasErrors ? result.errorMessages.join('; ') : null,
  };
};

const writeJsonAtomic = (filePath: string, data: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data));
  fs.renameSync(tmpPath, filePath);
};

export type WriteCodexSevenDayWindowParams = {
  dashboardDataDir: string | null | undefined;
  pjcode: string;
  codexHomeCandidates: string[] | null | undefined;
  codexHomeEnv: string | undefined;
  homeDirectory: string;
  now: Date;
  repository: CodexRolloutRateLimitRepository;
  logError: (message: string) => void;
};

export const writeCodexSevenDayWindowStatus = (
  params: WriteCodexSevenDayWindowParams,
): void => {
  if (!params.dashboardDataDir) {
    return;
  }
  const windows = resolveCodexHomeReferences({
    codexHomeCandidates: params.codexHomeCandidates,
    codexHomeEnv: params.codexHomeEnv,
    homeDirectory: params.homeDirectory,
  }).map((reference) => {
    const result = params.repository.readLatestSevenDayRateLimit(
      reference.directory,
    );
    for (const message of result.errorMessages) {
      params.logError(
        `Failed to read Codex rate limits for ${reference.label}: ${message}`,
      );
    }
    return toWindowStatus(reference.label, result);
  });
  const file: CodexSevenDayWindowFile = {
    capturedAt: params.now.toISOString(),
    windows,
  };
  writeJsonAtomic(
    path.join(
      params.dashboardDataDir,
      CODEX_SEVEN_DAY_WINDOW_DIR_NAME,
      `${params.pjcode}.json`,
    ),
    file,
  );
};
