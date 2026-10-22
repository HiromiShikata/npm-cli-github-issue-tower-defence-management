import { workerRuntimeOf } from './WorkerRuntimeResolveUseCase';

describe('workerRuntimeOf', () => {
  it.each([
    ['claude-opus-4-1', 'claude'],
    ['best', 'claude'],
    ['opus', 'claude'],
    ['opus[1m]', 'claude'],
    ['opusplan', 'claude'],
    ['sonnet', 'claude'],
    ['sonnet[1m]', 'claude'],
    ['fable', 'claude'],
    ['fable[1m]', 'claude'],
    ['haiku', 'claude'],
    ['zz-future-model-1', 'codex'],
  ] as const)('selects %s as %s', (modelName, expectedRuntime) => {
    expect(workerRuntimeOf(modelName)).toBe(expectedRuntime);
  });
});
