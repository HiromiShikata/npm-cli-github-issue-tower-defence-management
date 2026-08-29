import YAML from 'yaml';
import * as fs from 'fs';
import {
  DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS,
  LiveSessionOauthTokenSelectionSettings,
} from '../../../domain/usecases/LiveSessionOauthTokenSelectUseCase';
import { NORMAL_CONCURRENT_LIMIT } from '../../../domain/usecases/StartPreparationUseCase';

export const FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE = 'TDPM_FLEET_CONFIG';

export const LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY =
  'liveSessionOauthTokenSelection';
export const PREPARATION_WORKER_SECTION_KEY = 'preparationWorker';

export type PreparationWorkerSettings = {
  normalConcurrentLimit: number;
};

export const DEFAULT_PREPARATION_WORKER_SETTINGS: PreparationWorkerSettings = {
  normalConcurrentLimit: NORMAL_CONCURRENT_LIMIT,
};

export const resolveFleetConfigFilePath = (
  cliValue: string | null,
): string | null => {
  if (cliValue !== null && cliValue !== '') {
    return cliValue;
  }
  const fromEnvironment =
    process.env[FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE];
  if (fromEnvironment !== undefined && fromEnvironment !== '') {
    return fromEnvironment;
  }
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readFleetConfigSection = (
  fleetConfigFilePath: string,
  sectionKey: string,
): Record<string, unknown> | null => {
  const parsed: unknown = YAML.parse(
    fs.readFileSync(fleetConfigFilePath, 'utf8'),
  );
  if (parsed === null || parsed === undefined) {
    return null;
  }
  if (!isRecord(parsed)) {
    throw new Error(
      `${fleetConfigFilePath} does not hold a mapping at its top level.`,
    );
  }
  const section = parsed[sectionKey];
  if (section === undefined || section === null) {
    return null;
  }
  if (!isRecord(section)) {
    throw new Error(
      `${sectionKey} in ${fleetConfigFilePath} must be a mapping.`,
    );
  }
  return section;
};

const readBoundedNumber = (
  section: Record<string, unknown>,
  sectionKey: string,
  key: string,
  fleetConfigFilePath: string,
  fallback: number,
  isAccepted: (value: number) => boolean,
  requirement: string,
): number => {
  const value = section[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `${sectionKey}.${key} in ${fleetConfigFilePath} must be a number ${requirement}.`,
    );
  }
  if (!isAccepted(value)) {
    throw new Error(
      `${sectionKey}.${key} in ${fleetConfigFilePath} must be a number ${requirement}, but it is ${value}.`,
    );
  }
  return value;
};

export const loadLiveSessionOauthTokenSelectionSettings = (
  fleetConfigFilePath: string | null,
): LiveSessionOauthTokenSelectionSettings => {
  if (fleetConfigFilePath === null) {
    return DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS;
  }
  const section = readFleetConfigSection(
    fleetConfigFilePath,
    LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY,
  );
  if (section === null) {
    return DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS;
  }
  return {
    maxConcurrentSessionCount: readBoundedNumber(
      section,
      LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY,
      'maxConcurrentSessionCount',
      fleetConfigFilePath,
      DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.maxConcurrentSessionCount,
      (value) => Number.isInteger(value) && value >= 1,
      'integer of at least 1',
    ),
    fullSpeedFiveHourFreeRatio: readBoundedNumber(
      section,
      LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY,
      'fullSpeedFiveHourFreeRatio',
      fleetConfigFilePath,
      DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.fullSpeedFiveHourFreeRatio,
      (value) => value > 0 && value <= 1,
      'above 0 and at most 1',
    ),
    minFiveHourFreeRatio: readBoundedNumber(
      section,
      LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY,
      'minFiveHourFreeRatio',
      fleetConfigFilePath,
      DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.minFiveHourFreeRatio,
      (value) => value > 0 && value <= 1,
      'above 0 and at most 1',
    ),
    minSevenDayFreeRatio: readBoundedNumber(
      section,
      LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY,
      'minSevenDayFreeRatio',
      fleetConfigFilePath,
      DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.minSevenDayFreeRatio,
      (value) => value > 0 && value <= 1,
      'above 0 and at most 1',
    ),
  };
};

export const loadPreparationWorkerSettings = (
  fleetConfigFilePath: string | null,
): PreparationWorkerSettings => {
  if (fleetConfigFilePath === null) {
    return DEFAULT_PREPARATION_WORKER_SETTINGS;
  }
  const section = readFleetConfigSection(
    fleetConfigFilePath,
    PREPARATION_WORKER_SECTION_KEY,
  );
  if (section === null) {
    return DEFAULT_PREPARATION_WORKER_SETTINGS;
  }
  return {
    normalConcurrentLimit: readBoundedNumber(
      section,
      PREPARATION_WORKER_SECTION_KEY,
      'normalConcurrentLimit',
      fleetConfigFilePath,
      DEFAULT_PREPARATION_WORKER_SETTINGS.normalConcurrentLimit,
      (value) => Number.isInteger(value) && value >= 1,
      'integer of at least 1',
    ),
  };
};
