export type ModelRuntime = 'claude' | 'codex';

export const modelRuntimeOf = (modelName: string): ModelRuntime =>
  modelName.startsWith('claude-') ||
  modelName === 'opus' ||
  modelName === 'sonnet' ||
  modelName === 'fable'
    ? 'claude'
    : 'codex';

export const isValidModelId = (modelName: string): boolean =>
  /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(modelName);
