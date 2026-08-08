import YAML from 'yaml';
import * as fs from 'fs';
import {
  DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS,
  LiveSessionOauthTokenSelectionSettings,
} from '../../../domain/usecases/LiveSessionOauthTokenSelectUseCase';

export const FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE = 'TDPM_FLEET_CONFIG';

export const LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY =
  'liveSessionOauthTokenSelection';

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

const readSection = (
  fleetConfigFilePath: string,
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
  const section = parsed[LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY];
  if (section === undefined || section === null) {
    return null;
  }
  if (!isRecord(section)) {
    throw new Error(
      `${LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY} in ${fleetConfigFilePath} must be a mapping.`,
    );
  }
  return section;
};

const readBoundedNumber = (
  section: Record<string, unknown>,
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
      `${LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY}.${key} in ${fleetConfigFilePath} must be a number ${requirement}.`,
    );
  }
  if (!isAccepted(value)) {
    throw new Error(
      `${LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY}.${key} in ${fleetConfigFilePath} must be a number ${requirement}, but it is ${value}.`,
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
  const section = readSection(fleetConfigFilePath);
  if (section === null) {
    return DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS;
  }
  return {
    maxConcurrentSessionCount: readBoundedNumber(
      section,
      'maxConcurrentSessionCount',
      fleetConfigFilePath,
      DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.maxConcurrentSessionCount,
      (value) => Number.isInteger(value) && value >= 1,
      'integer of at least 1',
    ),
    fullSpeedFiveHourFreeRatio: readBoundedNumber(
      section,
      'fullSpeedFiveHourFreeRatio',
      fleetConfigFilePath,
      DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.fullSpeedFiveHourFreeRatio,
      (value) => value > 0 && value <= 1,
      'above 0 and at most 1',
    ),
  };
};
