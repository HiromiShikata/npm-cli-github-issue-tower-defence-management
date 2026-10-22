import { isValidModelId, modelRuntimeOf } from './ModelRuntime';

describe('modelRuntimeOf', () => {
  it.each([
    'claude-opus-4-8',
    'claude-future-version',
    'claude-sonnet-5-5[1m]',
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
  it.each([
    'claude-opus-4-8',
    'claude-sonnet-5-5[1m]',
    'zz-future-model-1',
    'provider/model:latest',
  ])('accepts model id syntax %s', (modelName) =>
    expect(isValidModelId(modelName)).toBe(true),
  );

  it.each([
    '',
    'model with spaces',
    'model;bad',
    'model$bad',
    'model`bad',
    'model\nbad',
    'model\n',
    'model\r\n',
    'model"bad',
    "model'bad",
    'model(bad',
    'model)bad',
    'model|bad',
    'model&bad',
    'model<bad',
    'model>bad',
    '--option',
    '[1m]',
  ])('rejects malformed model id %s', (modelName) =>
    expect(isValidModelId(modelName)).toBe(false),
  );
});
