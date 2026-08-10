import { NodeLocalCommandRunner } from './NodeLocalCommandRunner';

describe('NodeLocalCommandRunner large output', () => {
  it('should keep the whole stdout when a command writes more than one mebibyte', async () => {
    const runner = new NodeLocalCommandRunner();
    const outputByteLength = 3 * 1024 * 1024;

    const result = await runner.runCommand(process.execPath, [
      '-e',
      `process.stdout.write('x'.repeat(${outputByteLength}))`,
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBe(outputByteLength);
  }, 30000);
});
