import { RealSleeper } from './RealSleeper';

describe('RealSleeper', () => {
  it('resolves after roughly the requested delay', async () => {
    const sleeper = new RealSleeper();
    const start = Date.now();
    await sleeper.sleep(30);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(20);
  });

  it('resolves immediately for a non-positive delay', async () => {
    const sleeper = new RealSleeper();
    const start = Date.now();
    await sleeper.sleep(0);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(20);
  });
});
