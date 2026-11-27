import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProcRunningSubagentFactsRepository } from './ProcRunningSubagentFactsRepository';

const writeProcess = (
  root: string,
  pid: number,
  ppid: number,
  argv: string[],
  environment: Record<string, string | undefined>,
): void => {
  const directory = path.join(root, String(pid));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'stat'),
    `${pid} (process) S ${ppid} 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0`,
  );
  fs.writeFileSync(
    path.join(directory, 'cmdline'),
    Buffer.from(`${argv.join('\0')}\0`),
  );
  fs.writeFileSync(
    path.join(directory, 'environ'),
    Buffer.from(
      `${Object.entries(environment)
        .map(([key, value]) => `${key}=${value}`)
        .join('\0')}\0`,
    ),
  );
};

describe('ProcRunningSubagentFactsRepository', () => {
  it.each([
    {
      name: 'detects a worker and keys it by its raw token',
      argv: ['claude', '-p', 'Take ownership of issue'],
      env: { CLAUDE_CODE_OAUTH_TOKEN: 'token-alpha', HOME: '/home/test' },
      kind: 'claude-worker',
    },
    {
      name: 'does not classify a Claude process without the worker prompt',
      argv: ['claude', '-p', 'other prompt'],
      env: { CLAUDE_CODE_OAUTH_TOKEN: 'token-alpha' },
      kind: 'other',
    },
    {
      name: 'does not classify a worker without a token',
      argv: ['claude', '-p', 'Take ownership of issue'],
      env: { HOME: '/home/test' },
      kind: 'other',
    },
    {
      name: 'detects a Codex launcher',
      argv: ['node', '/opt/codex', 'exec'],
      env: {},
      kind: 'codex-launcher',
    },
  ])('$name', ({ argv, env, kind }) => {
    const procDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tdpm-proc-'));
    try {
      writeProcess(procDirectory, 10, 1, argv, env);
      const facts = new ProcRunningSubagentFactsRepository(
        procDirectory,
      ).listFacts();
      expect(facts[0].kind).toBe(kind);
      expect(facts[0]).not.toHaveProperty('token', 'token-alpha');
      if (kind === 'claude-worker') {
        expect(facts[0].workerKey).toBe('token-alpha');
        expect(facts[0].workerKey).not.toMatch(/^[0-9a-f]{64}$/);
      }
    } finally {
      fs.rmSync(procDirectory, { recursive: true, force: true });
    }
  });

  it('counts unfinished metadata and returns null for unreadable metadata', () => {
    const procDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tdpm-proc-'));
    try {
      const configDirectory = path.join(procDirectory, 'config');
      writeProcess(
        procDirectory,
        10,
        1,
        ['claude', '-p', 'Take ownership of issue'],
        {
          CLAUDE_CODE_OAUTH_TOKEN: 'token-alpha',
          CLAUDE_CONFIG_DIR: configDirectory,
        },
      );
      const sessionDirectory = path.join(
        configDirectory,
        'projects',
        'demo',
        'session',
        'subagents',
      );
      fs.mkdirSync(sessionDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(sessionDirectory, 'finished.meta.json'),
        JSON.stringify({ finished: true }),
      );
      fs.writeFileSync(
        path.join(sessionDirectory, 'unfinished.meta.json'),
        JSON.stringify({ finished: false }),
      );
      const facts = new ProcRunningSubagentFactsRepository(
        procDirectory,
      ).listFacts();
      expect(facts[0].unfinishedClaudeSubagentCount).toBe(1);
      fs.writeFileSync(
        path.join(sessionDirectory, 'broken.meta.json'),
        '{not json',
      );
      expect(
        new ProcRunningSubagentFactsRepository(procDirectory).listFacts()[0]
          .unfinishedClaudeSubagentCount,
      ).toBeNull();
    } finally {
      fs.rmSync(procDirectory, { recursive: true, force: true });
    }
  });

  it('counts a session whose subagents directory does not exist yet as zero', () => {
    const procDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tdpm-proc-'));
    try {
      const configDirectory = path.join(procDirectory, 'config');
      writeProcess(
        procDirectory,
        10,
        1,
        ['claude', '-p', 'Take ownership of issue'],
        {
          CLAUDE_CODE_OAUTH_TOKEN: 'token-alpha',
          CLAUDE_CONFIG_DIR: configDirectory,
        },
      );
      fs.mkdirSync(path.join(configDirectory, 'projects', 'demo', 'session'), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(configDirectory, 'projects', 'stray-file.txt'),
        'not a project directory',
      );
      expect(
        new ProcRunningSubagentFactsRepository(procDirectory).listFacts()[0]
          .unfinishedClaudeSubagentCount,
      ).toBe(0);
    } finally {
      fs.rmSync(procDirectory, { recursive: true, force: true });
    }
  });
  it('counts a config directory without a projects directory as zero', () => {
    const procDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tdpm-proc-'));
    try {
      const configDirectory = path.join(procDirectory, 'config');
      fs.mkdirSync(configDirectory, { recursive: true });
      writeProcess(
        procDirectory,
        10,
        1,
        ['claude', '-p', 'Take ownership of issue'],
        {
          CLAUDE_CODE_OAUTH_TOKEN: 'token-alpha',
          CLAUDE_CONFIG_DIR: configDirectory,
        },
      );
      expect(
        new ProcRunningSubagentFactsRepository(procDirectory).listFacts()[0]
          .unfinishedClaudeSubagentCount,
      ).toBe(0);
    } finally {
      fs.rmSync(procDirectory, { recursive: true, force: true });
    }
  });
  it('treats subagent metadata that parses to a non-object as unreadable', () => {
    const procDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tdpm-proc-'));
    try {
      const configDirectory = path.join(procDirectory, 'config');
      writeProcess(
        procDirectory,
        10,
        1,
        ['claude', '-p', 'Take ownership of issue'],
        {
          CLAUDE_CODE_OAUTH_TOKEN: 'token-alpha',
          CLAUDE_CONFIG_DIR: configDirectory,
        },
      );
      const sessionDirectory = path.join(
        configDirectory,
        'projects',
        'demo',
        'session',
        'subagents',
      );
      fs.mkdirSync(sessionDirectory, { recursive: true });
      fs.writeFileSync(path.join(sessionDirectory, 'array.meta.json'), '[]');
      expect(
        new ProcRunningSubagentFactsRepository(procDirectory).listFacts()[0]
          .unfinishedClaudeSubagentCount,
      ).toBeNull();
    } finally {
      fs.rmSync(procDirectory, { recursive: true, force: true });
    }
  });
});
