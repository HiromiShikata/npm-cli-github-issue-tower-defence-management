import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS } from '../../../domain/usecases/LiveSessionOauthTokenSelectUseCase';
import {
  FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE,
  loadLiveSessionOauthTokenSelectionSettings,
  resolveFleetConfigFilePath,
} from './fleetConfig';

describe('resolveFleetConfigFilePath', () => {
  const originalEnvironmentValue =
    process.env[FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE];

  afterEach(() => {
    if (originalEnvironmentValue === undefined) {
      delete process.env[FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE];
      return;
    }
    process.env[FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE] =
      originalEnvironmentValue;
  });

  it('prefers the explicit value over the environment variable', () => {
    process.env[FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE] =
      '/from/environment.yaml';

    expect(resolveFleetConfigFilePath('/from/option.yaml')).toBe(
      '/from/option.yaml',
    );
  });

  it('falls back to the environment variable when no explicit value is given', () => {
    process.env[FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE] =
      '/from/environment.yaml';

    expect(resolveFleetConfigFilePath(null)).toBe('/from/environment.yaml');
  });

  it('returns null when neither an explicit value nor the environment variable is set', () => {
    delete process.env[FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE];

    expect(resolveFleetConfigFilePath(null)).toBeNull();
  });
});

describe('loadLiveSessionOauthTokenSelectionSettings', () => {
  let tempDir: string;

  const writeFleetConfig = (content: string): string => {
    const fleetConfigFilePath = path.join(tempDir, 'fleet.config.yaml');
    fs.writeFileSync(fleetConfigFilePath, content);
    return fleetConfigFilePath;
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-config-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns the built-in settings when no fleet config path is given', () => {
    expect(loadLiveSessionOauthTokenSelectionSettings(null)).toEqual(
      DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS,
    );
  });

  it('reads all tuning numbers from the fleet config file', () => {
    const fleetConfigFilePath = writeFleetConfig(
      [
        'inTmuxLauncherCommand: cl',
        'liveSessionOauthTokenSelection:',
        '  maxConcurrentSessionCount: 16',
        '  fullSpeedFiveHourFreeRatio: 0.4',
        '  minFiveHourFreeRatio: 0.7',
        '  minSevenDayFreeRatio: 0.2',
      ].join('\n'),
    );

    expect(
      loadLiveSessionOauthTokenSelectionSettings(fleetConfigFilePath),
    ).toEqual({
      maxConcurrentSessionCount: 16,
      fullSpeedFiveHourFreeRatio: 0.4,
      minFiveHourFreeRatio: 0.7,
      minSevenDayFreeRatio: 0.2,
    });
  });

  it('keeps the built-in value for a tuning number the fleet config omits', () => {
    const fleetConfigFilePath = writeFleetConfig(
      [
        'liveSessionOauthTokenSelection:',
        '  maxConcurrentSessionCount: 16',
      ].join('\n'),
    );

    expect(
      loadLiveSessionOauthTokenSelectionSettings(fleetConfigFilePath),
    ).toEqual({
      maxConcurrentSessionCount: 16,
      fullSpeedFiveHourFreeRatio:
        DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.fullSpeedFiveHourFreeRatio,
      minFiveHourFreeRatio:
        DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.minFiveHourFreeRatio,
      minSevenDayFreeRatio:
        DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.minSevenDayFreeRatio,
    });
  });

  it('returns the built-in settings when the fleet config carries no live session section', () => {
    const fleetConfigFilePath = writeFleetConfig('inTmuxLauncherCommand: cl\n');

    expect(
      loadLiveSessionOauthTokenSelectionSettings(fleetConfigFilePath),
    ).toEqual(DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS);
  });

  it('returns the built-in settings for an empty fleet config file', () => {
    const fleetConfigFilePath = writeFleetConfig('');

    expect(
      loadLiveSessionOauthTokenSelectionSettings(fleetConfigFilePath),
    ).toEqual(DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS);
  });

  it('throws when the fleet config file does not exist', () => {
    expect(() =>
      loadLiveSessionOauthTokenSelectionSettings(
        path.join(tempDir, 'missing.yaml'),
      ),
    ).toThrow();
  });

  it('throws when the maximum concurrent session count is not a positive integer', () => {
    const fleetConfigFilePath = writeFleetConfig(
      [
        'liveSessionOauthTokenSelection:',
        '  maxConcurrentSessionCount: 0',
      ].join('\n'),
    );

    expect(() =>
      loadLiveSessionOauthTokenSelectionSettings(fleetConfigFilePath),
    ).toThrow('maxConcurrentSessionCount');
  });

  it('throws when the five hour free ratio is above one', () => {
    const fleetConfigFilePath = writeFleetConfig(
      [
        'liveSessionOauthTokenSelection:',
        '  fullSpeedFiveHourFreeRatio: 1.5',
      ].join('\n'),
    );

    expect(() =>
      loadLiveSessionOauthTokenSelectionSettings(fleetConfigFilePath),
    ).toThrow('fullSpeedFiveHourFreeRatio');
  });

  it('throws when the minimum five hour free ratio is above one', () => {
    const fleetConfigFilePath = writeFleetConfig(
      ['liveSessionOauthTokenSelection:', '  minFiveHourFreeRatio: 1.5'].join(
        '\n',
      ),
    );

    expect(() =>
      loadLiveSessionOauthTokenSelectionSettings(fleetConfigFilePath),
    ).toThrow('minFiveHourFreeRatio');
  });

  it('throws when the minimum seven day free ratio is above one', () => {
    const fleetConfigFilePath = writeFleetConfig(
      ['liveSessionOauthTokenSelection:', '  minSevenDayFreeRatio: 1.5'].join(
        '\n',
      ),
    );

    expect(() =>
      loadLiveSessionOauthTokenSelectionSettings(fleetConfigFilePath),
    ).toThrow('minSevenDayFreeRatio');
  });

  it('throws when a tuning number is written as a string', () => {
    const fleetConfigFilePath = writeFleetConfig(
      [
        'liveSessionOauthTokenSelection:',
        "  maxConcurrentSessionCount: '16'",
      ].join('\n'),
    );

    expect(() =>
      loadLiveSessionOauthTokenSelectionSettings(fleetConfigFilePath),
    ).toThrow('must be a number');
  });

  it('throws when the live session section is not a mapping', () => {
    const fleetConfigFilePath = writeFleetConfig(
      'liveSessionOauthTokenSelection: 10\n',
    );

    expect(() =>
      loadLiveSessionOauthTokenSelectionSettings(fleetConfigFilePath),
    ).toThrow('must be a mapping');
  });
});
