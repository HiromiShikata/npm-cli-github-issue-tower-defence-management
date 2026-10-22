export type WorkerRuntime = 'claude' | 'codex';

const CLAUDE_MODEL_ALIASES = new Set([
  'best',
  'fable',
  'fable[1m]',
  'opus',
  'opus[1m]',
  'opusplan',
  'sonnet',
  'sonnet[1m]',
  'haiku',
]);

export const workerRuntimeOf = (modelName: string): WorkerRuntime =>
  modelName.startsWith('claude-') || CLAUDE_MODEL_ALIASES.has(modelName)
    ? 'claude'
    : 'codex';
