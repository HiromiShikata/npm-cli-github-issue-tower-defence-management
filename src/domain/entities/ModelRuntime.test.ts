import { isValidModelId, modelRuntimeOf } from './ModelRuntime';

describe('modelRuntimeOf', () => {
  it.each([
    'claude-opus-4-8',
    'claude-future-version',
    'opus',
    'sonnet',
    'fable',
  ])('selects Claude for the Claude Code model name %s', (modelName) => {
    expect(modelRuntimeOf(modelName)).toBe('claude');
  });

  it('selects Codex for a made-up future model name', () => {
    expect(modelRuntimeOf('zz-future-model-1')).toBe('codex');
  });
});

describe('isValidModelId', () => {
  it.each(['claude-opus-4-8', 'zz-future-model-1', 'provider/model:latest'])(
    'accepts model id syntax %s',
    (modelName) => expect(isValidModelId(modelName)).toBe(true),
  );

  it.each(['', 'model with spaces', '--option'])(
    'rejects malformed model id %s',
    (modelName) => expect(isValidModelId(modelName)).toBe(false),
  );
});
