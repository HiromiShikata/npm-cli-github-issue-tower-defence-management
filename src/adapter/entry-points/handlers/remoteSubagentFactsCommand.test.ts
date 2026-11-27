import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { REMOTE_SUBAGENT_FACTS_COMMAND } from './remoteMachineStatusWriter';

describe('REMOTE_SUBAGENT_FACTS_COMMAND', () => {
  it('prints process facts from the injected proc tree without printing token values', () => {
    const procDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'tdpm-remote-proc-'),
    );
    try {
      const processDirectory = path.join(procDirectory, '10');
      fs.mkdirSync(processDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(processDirectory, 'stat'),
        '10 (process) S 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0',
      );
      fs.writeFileSync(
        path.join(processDirectory, 'cmdline'),
        Buffer.from('claude\0-p\0Take ownership of issue\0'),
      );
      fs.writeFileSync(
        path.join(processDirectory, 'environ'),
        Buffer.from('CLAUDE_CODE_OAUTH_TOKEN=token-alpha\0HOME=/tmp\0'),
      );
      const output = execFileSync('sh', ['-c', REMOTE_SUBAGENT_FACTS_COMMAND], {
        env: { ...process.env, TDPM_PROC_DIR: procDirectory },
        encoding: 'utf8',
      });
      expect(output).toMatch(/^10\t1\tclaude-worker\t[0-9a-f]{64}\t\?/m);
      expect(output).not.toContain('token-alpha');
    } finally {
      fs.rmSync(procDirectory, { recursive: true, force: true });
    }
  });
  it('reports zero unfinished subagents for a worker session whose subagents directory does not exist yet', () => {
    const procDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'tdpm-remote-proc-'),
    );
    const configDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'tdpm-remote-config-'),
    );
    try {
      const processDirectory = path.join(procDirectory, '10');
      fs.mkdirSync(processDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(processDirectory, 'stat'),
        '10 (process) S 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0',
      );
      fs.writeFileSync(
        path.join(processDirectory, 'cmdline'),
        Buffer.from('claude\0-p\0Take ownership of issue\0'),
      );
      fs.writeFileSync(
        path.join(processDirectory, 'environ'),
        Buffer.from(
          `CLAUDE_CODE_OAUTH_TOKEN=token-alpha\0CLAUDE_CONFIG_DIR=${configDirectory}\0CLAUDE_CODE_SESSION_ID=session-one\0`,
        ),
      );
      fs.mkdirSync(
        path.join(configDirectory, 'projects', 'demo', 'session-one'),
        { recursive: true },
      );
      const output = execFileSync('sh', ['-c', REMOTE_SUBAGENT_FACTS_COMMAND], {
        env: { ...process.env, TDPM_PROC_DIR: procDirectory },
        encoding: 'utf8',
      });
      expect(output).toMatch(/^10\t1\tclaude-worker\t[0-9a-f]{64}\t0$/m);
    } finally {
      fs.rmSync(procDirectory, { recursive: true, force: true });
      fs.rmSync(configDirectory, { recursive: true, force: true });
    }
  });
});
