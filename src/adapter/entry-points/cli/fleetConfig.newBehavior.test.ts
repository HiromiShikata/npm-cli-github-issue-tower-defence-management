/**
 * Acceptance tests for SC-6: fiveHourShareConsumedPerSessionHour in fleet config.
 *
 * SC-6b: value of 0 must throw with "fiveHourShareConsumedPerSessionHour" in message
 * SC-6c: value above 1 (e.g. 1.1) must throw with "fiveHourShareConsumedPerSessionHour" in message
 * SC-6a: value of 0.1 is loaded and stored in the returned settings object
 *
 * These tests MUST FAIL against the current implementation because the field
 * is not yet validated or returned by loadLiveSessionOauthTokenSelectionSettings.
 *
 * R3 (regression): existing fullSpeedFiveHourFreeRatio validation continues to
 * reject a value of 1.5 — this behaviour must not be broken by the change.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadLiveSessionOauthTokenSelectionSettings } from './fleetConfig';

describe('SC-6b: fiveHourShareConsumedPerSessionHour value of 0 is rejected', () => {
  let tempDir: string;

  const writeFleetConfig = (content: string): string => {
    const fleetConfigFilePath = path.join(tempDir, 'fleet.config.yaml');
    fs.writeFileSync(fleetConfigFilePath, content);
    return fleetConfigFilePath;
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-config-sc6b-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws an error containing "fiveHourShareConsumedPerSessionHour" when the value is 0', () => {
    /**
     * A share of 0 would cause division by zero in the new formula; it must be rejected.
     * Currently: no validation exists for this field, so no throw occurs → FAILS.
     */
    const configPath = writeFleetConfig(
      [
        'liveSessionOauthTokenSelection:',
        '  fiveHourShareConsumedPerSessionHour: 0',
      ].join('\n'),
    );

    expect(() =>
      loadLiveSessionOauthTokenSelectionSettings(configPath),
    ).toThrow('fiveHourShareConsumedPerSessionHour');
  });
});

describe('SC-6c: fiveHourShareConsumedPerSessionHour value above 1 is rejected', () => {
  let tempDir: string;

  const writeFleetConfig = (content: string): string => {
    const fleetConfigFilePath = path.join(tempDir, 'fleet.config.yaml');
    fs.writeFileSync(fleetConfigFilePath, content);
    return fleetConfigFilePath;
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-config-sc6c-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws an error containing "fiveHourShareConsumedPerSessionHour" when the value is 1.1', () => {
    /**
     * A share above 1 is nonsensical (a single session would consume more than the full window).
     * Currently: no validation exists for this field, so no throw occurs → FAILS.
     */
    const configPath = writeFleetConfig(
      [
        'liveSessionOauthTokenSelection:',
        '  fiveHourShareConsumedPerSessionHour: 1.1',
      ].join('\n'),
    );

    expect(() =>
      loadLiveSessionOauthTokenSelectionSettings(configPath),
    ).toThrow('fiveHourShareConsumedPerSessionHour');
  });
});

describe('SC-6a: fiveHourShareConsumedPerSessionHour is loaded from fleet config', () => {
  let tempDir: string;

  const writeFleetConfig = (content: string): string => {
    const fleetConfigFilePath = path.join(tempDir, 'fleet.config.yaml');
    fs.writeFileSync(fleetConfigFilePath, content);
    return fleetConfigFilePath;
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-config-sc6a-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('includes fiveHourShareConsumedPerSessionHour in the returned settings when set to 0.1', () => {
    /**
     * The loader must read and surface the new field so the use case can consume it.
     * Currently: the field is not parsed and the returned object has no such key → FAILS.
     */
    const configPath = writeFleetConfig(
      [
        'liveSessionOauthTokenSelection:',
        '  fiveHourShareConsumedPerSessionHour: 0.1',
      ].join('\n'),
    );

    const settings = loadLiveSessionOauthTokenSelectionSettings(
      configPath,
    ) as Record<string, unknown>;

    expect(settings['fiveHourShareConsumedPerSessionHour']).toBe(0.1);
  });

  it('uses the built-in default of 0.05 when fiveHourShareConsumedPerSessionHour is omitted from fleet config', () => {
    /**
     * The default value must be 0.05 (5 % of the 5-hour window per concurrent session).
     * Currently: the field is absent from the returned object, so accessing it yields undefined → FAILS.
     */
    const configPath = writeFleetConfig(
      [
        'liveSessionOauthTokenSelection:',
        '  maxConcurrentSessionCount: 10',
      ].join('\n'),
    );

    const settings = loadLiveSessionOauthTokenSelectionSettings(
      configPath,
    ) as Record<string, unknown>;

    expect(settings['fiveHourShareConsumedPerSessionHour']).toBe(0.05);
  });
});

describe('R3 (regression): existing fullSpeedFiveHourFreeRatio validation is preserved', () => {
  let tempDir: string;

  const writeFleetConfig = (content: string): string => {
    const fleetConfigFilePath = path.join(tempDir, 'fleet.config.yaml');
    fs.writeFileSync(fleetConfigFilePath, content);
    return fleetConfigFilePath;
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-config-r3-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('rejects fullSpeedFiveHourFreeRatio of 1.5 (above the valid range of (0, 1])', () => {
    const configPath = writeFleetConfig(
      [
        'liveSessionOauthTokenSelection:',
        '  fullSpeedFiveHourFreeRatio: 1.5',
      ].join('\n'),
    );

    expect(() =>
      loadLiveSessionOauthTokenSelectionSettings(configPath),
    ).toThrow('fullSpeedFiveHourFreeRatio');
  });

  it('accepts fullSpeedFiveHourFreeRatio of 1.0 (the upper boundary of the valid range)', () => {
    const configPath = writeFleetConfig(
      [
        'liveSessionOauthTokenSelection:',
        '  fullSpeedFiveHourFreeRatio: 1.0',
      ].join('\n'),
    );

    expect(() =>
      loadLiveSessionOauthTokenSelectionSettings(configPath),
    ).not.toThrow();
  });
});
