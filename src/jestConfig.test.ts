import { readFileSync } from 'fs';
import { join } from 'path';

const readJestConfig = () => {
  const content = readFileSync(join(__dirname, '..', 'jest.config.js'), 'utf8');

  const maxWorkersMatch = content.match(/\bmaxWorkers\s*:\s*(\d+)/);
  if (!maxWorkersMatch)
    throw new Error('maxWorkers not found in jest.config.js');

  const forceExitMatch = content.match(/\bforceExit\s*:\s*(true|false)/);
  if (!forceExitMatch) throw new Error('forceExit not found in jest.config.js');

  const testTimeoutMatch = content.match(/\btestTimeout\s*:\s*(\d+)/);
  if (!testTimeoutMatch)
    throw new Error('testTimeout not found in jest.config.js');

  return {
    maxWorkers: Number(maxWorkersMatch[1]),
    forceExit: forceExitMatch[1] === 'true',
    testTimeout: Number(testTimeoutMatch[1]),
  };
};

const readTestRelatedScript = () => {
  const content = readFileSync(join(__dirname, '..', 'package.json'), 'utf8');
  const match = content.match(/"test:related"\s*:\s*"([^"]+)"/);
  if (!match) throw new Error('test:related script not found in package.json');
  return match[1];
};

describe('jest config prevents resource exhaustion under concurrent workspace preparations', () => {
  it('caps maxWorkers to 2 to prevent OOM', () => {
    expect(readJestConfig().maxWorkers).toBeLessThanOrEqual(2);
  });

  it('forces exit to terminate workers after tests complete', () => {
    expect(readJestConfig().forceExit).toBe(true);
  });

  it('has a per-test timeout to auto-terminate long-running tests', () => {
    const { testTimeout } = readJestConfig();
    expect(testTimeout).toBeGreaterThan(0);
    expect(testTimeout).toBeLessThanOrEqual(120000);
  });
});

describe('npm scripts', () => {
  it('provides test:related to run only changed-file tests', () => {
    expect(readTestRelatedScript()).toContain('--onlyChanged');
    expect(readTestRelatedScript()).toContain('--passWithNoTests');
  });
});
