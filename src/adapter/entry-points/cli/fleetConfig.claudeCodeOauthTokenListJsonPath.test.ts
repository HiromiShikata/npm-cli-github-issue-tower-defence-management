import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadFleetClaudeCodeOauthTokenListJsonPath } from './fleetConfig';

describe('loadFleetClaudeCodeOauthTokenListJsonPath', () => {
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

  it('returns null when no fleet config path is given', () => {
    expect(loadFleetClaudeCodeOauthTokenListJsonPath(null)).toBeNull();
  });

  it('returns the top-level claudeCodeOauthTokenListJsonPath as written in the fleet config file', () => {
    const fleetConfigFilePath = writeFleetConfig(
      [
        'claudeCodeOauthTokenListJsonPath: ~/fleet/claude-code-oauth-tokens.json',
        'startPreparation:',
        '  maximumPreparingIssuesCount: 100',
      ].join('\n'),
    );

    expect(loadFleetClaudeCodeOauthTokenListJsonPath(fleetConfigFilePath)).toBe(
      '~/fleet/claude-code-oauth-tokens.json',
    );
  });

  it('returns null when the key is absent from the fleet config', () => {
    const fleetConfigFilePath = writeFleetConfig(
      'preparationWorker:\n  normalConcurrentLimit: 5\n',
    );

    expect(
      loadFleetClaudeCodeOauthTokenListJsonPath(fleetConfigFilePath),
    ).toBeNull();
  });

  it('returns null when the key is only set inside a section', () => {
    const fleetConfigFilePath = writeFleetConfig(
      [
        'startPreparation:',
        '  claudeCodeOauthTokenListJsonPath: /srv/fleet/claude-code-oauth-tokens.json',
      ].join('\n'),
    );

    expect(
      loadFleetClaudeCodeOauthTokenListJsonPath(fleetConfigFilePath),
    ).toBeNull();
  });

  it('returns null for an empty fleet config file', () => {
    const fleetConfigFilePath = writeFleetConfig('');

    expect(
      loadFleetClaudeCodeOauthTokenListJsonPath(fleetConfigFilePath),
    ).toBeNull();
  });

  it('throws when the fleet config file does not exist', () => {
    expect(() =>
      loadFleetClaudeCodeOauthTokenListJsonPath(
        path.join(tempDir, 'missing.yaml'),
      ),
    ).toThrow();
  });

  it('throws naming the key when the value is not a string', () => {
    const fleetConfigFilePath = writeFleetConfig(
      'claudeCodeOauthTokenListJsonPath: 42\n',
    );

    expect(() =>
      loadFleetClaudeCodeOauthTokenListJsonPath(fleetConfigFilePath),
    ).toThrow('claudeCodeOauthTokenListJsonPath');
  });
});
