import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  parseRemoteSubagentFactsOutput,
  REMOTE_SUBAGENT_FACTS_COMMAND,
} from './remoteMachineStatusWriter';

const TOKEN = 'token-alpha';
const TOKEN_KEY = crypto.createHash('sha256').update(TOKEN).digest('hex');

type Scenario = {
  metadataFiles: Record<string, string | undefined> | null;
  createProjects: boolean;
};

const runFactsCommand = (scenario: Scenario) => {
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
        `CLAUDE_CODE_OAUTH_TOKEN=${TOKEN}\0CLAUDE_CONFIG_DIR=${configDirectory}\0CLAUDE_CODE_SESSION_ID=session-one\0`,
      ),
    );
    if (scenario.createProjects) {
      fs.mkdirSync(
        path.join(configDirectory, 'projects', 'demo', 'session-one'),
        { recursive: true },
      );
    }
    if (scenario.metadataFiles !== null) {
      const subagents = path.join(
        configDirectory,
        'projects',
        'demo',
        'session-one',
        'subagents',
      );
      fs.mkdirSync(subagents, { recursive: true });
      for (const [name, content] of Object.entries(scenario.metadataFiles)) {
        if (content !== undefined)
          fs.writeFileSync(path.join(subagents, name), content);
      }
    }
    const output = execFileSync('sh', ['-c', REMOTE_SUBAGENT_FACTS_COMMAND], {
      env: { ...process.env, TDPM_PROC_DIR: procDirectory },
      encoding: 'utf8',
    });
    return { output, parsed: parseRemoteSubagentFactsOutput(output) };
  } finally {
    fs.rmSync(procDirectory, { recursive: true, force: true });
    fs.rmSync(configDirectory, { recursive: true, force: true });
  }
};

describe('REMOTE_SUBAGENT_FACTS_COMMAND', () => {
  it('prints the worker row without token values and parses it with the metadata count', () => {
    const { output, parsed } = runFactsCommand({
      metadataFiles: { 'a.meta.json': '{"finished":false}' },
      createProjects: true,
    });
    expect(output).not.toContain(TOKEN);
    expect(parsed.subagentCounts.claudeByTokenKey[TOKEN_KEY]).toBe(1);
    expect(parsed.unmeasuredClaudeTokenKeys).toEqual([]);
  });

  it.each([
    {
      name: 'counts unfinished metadata and skips finished metadata',
      metadataFiles: {
        'a.meta.json': '{"finished":true}',
        'b.meta.json': '{"finished":false}',
        'c.meta.json': '{}',
      },
      createProjects: true,
      claude: 2,
      unmeasured: [],
    },
    {
      name: 'counts zero when the session has no subagents directory',
      metadataFiles: null,
      createProjects: true,
      claude: 0,
      unmeasured: [],
    },
    {
      name: 'counts zero when the config directory has no projects directory',
      metadataFiles: null,
      createProjects: false,
      claude: 0,
      unmeasured: [],
    },
    {
      name: 'marks the token unmeasured when metadata is wrapped in braces but is not JSON',
      metadataFiles: { 'broken.meta.json': '{garbage}' },
      createProjects: true,
      claude: undefined,
      unmeasured: [TOKEN_KEY],
    },
    {
      name: 'marks the token unmeasured when metadata is truncated JSON',
      metadataFiles: { 'truncated.meta.json': '{"finished": tr' },
      createProjects: true,
      claude: undefined,
      unmeasured: [TOKEN_KEY],
    },
    {
      name: 'marks the token unmeasured when metadata parses to an array',
      metadataFiles: { 'array.meta.json': '[]' },
      createProjects: true,
      claude: undefined,
      unmeasured: [TOKEN_KEY],
    },
  ])('$name', ({ metadataFiles, createProjects, claude, unmeasured }) => {
    const { parsed } = runFactsCommand({ metadataFiles, createProjects });
    expect(parsed.subagentCounts.claudeByTokenKey[TOKEN_KEY]).toBe(claude);
    expect(parsed.unmeasuredClaudeTokenKeys).toEqual(unmeasured);
  });
});
