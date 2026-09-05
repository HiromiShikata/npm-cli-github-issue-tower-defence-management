const jestConfig = require('../jest.config.js');
const packageJson = require('../package.json');

describe('jest config prevents resource exhaustion under concurrent workspace preparations', () => {
  it('caps maxWorkers to 2 to prevent OOM', () => {
    expect(jestConfig.maxWorkers).toBeLessThanOrEqual(2);
  });

  it('forces exit to terminate workers after tests complete', () => {
    expect(jestConfig.forceExit).toBe(true);
  });

  it('has a per-test timeout to auto-terminate long-running tests', () => {
    expect(typeof jestConfig.testTimeout).toBe('number');
    expect(jestConfig.testTimeout).toBeGreaterThan(0);
    expect(jestConfig.testTimeout).toBeLessThanOrEqual(120000);
  });
});

describe('npm scripts', () => {
  it('provides test:related to run only changed-file tests', () => {
    const script: string = packageJson.scripts['test:related'];
    expect(script).toBeDefined();
    expect(script).toContain('--onlyChanged');
    expect(script).toContain('--passWithNoTests');
  });
});
