import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  parseRemoteSubagentFactsOutput,
  REMOTE_SUBAGENT_FACTS_COMMAND,
} from './remoteMachineStatusWriter';

const TOKEN = 'token-alpha';
const ISSUE_URL = 'https://github.com/example-org/example-repo/issues/101';
const WORKER_ROW = `10\t1\tclaude-worker\t${ISSUE_URL}\t-`;
const CODEX_ROW = '11\t10\tcodex-launcher\t-\t-';

type Scenario = {
  metadataFiles: Record<string, string | undefined> | null;
  createProjects: boolean;
  withToken: boolean;
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
      Buffer.from(`claude\0-p\0Take ownership of ${ISSUE_URL}\0`),
    );
    const environment = [
      ...(scenario.withToken ? [`CLAUDE_CODE_OAUTH_TOKEN=${TOKEN}`] : []),
      `CLAUDE_CONFIG_DIR=${configDirectory}`,
      'CLAUDE_CODE_SESSION_ID=session-one',
    ];
    fs.writeFileSync(
      path.join(processDirectory, 'environ'),
      Buffer.from(environment.map((entry) => `${entry}\0`).join('')),
    );
    const codexDirectory = path.join(procDirectory, '11');
    fs.mkdirSync(codexDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(codexDirectory, 'stat'),
      '11 (node) S 10 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0',
    );
    fs.writeFileSync(
      path.join(codexDirectory, 'cmdline'),
      Buffer.from('node\0/opt/codex\0exec\0'),
    );
    fs.writeFileSync(path.join(codexDirectory, 'environ'), '');
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
  it('prints the worker row keyed by its issue URL and the Codex row, with no token or hash', () => {
    const { output, parsed } = runFactsCommand({
      metadataFiles: { 'a.meta.json': '{"finished":false}' },
      createProjects: true,
      withToken: true,
    });
    expect(output.split('\n')).toContain(WORKER_ROW);
    expect(output.split('\n')).toContain(CODEX_ROW);
    expect(output).not.toContain(TOKEN);
    expect(output).not.toMatch(/[0-9a-f]{64}/);
    expect(parsed.subagentCounts.claudeByIssueUrl[ISSUE_URL]).toBe(1);
    expect(parsed.subagentCounts.codexByIssueUrl[ISSUE_URL]).toBe(1);
    expect(parsed.unmeasuredIssueUrls).toEqual([]);
  });

  it('prints the worker row when the worker environment has no token', () => {
    const { output, parsed } = runFactsCommand({
      metadataFiles: null,
      createProjects: true,
      withToken: false,
    });
    expect(output.split('\n')).toContain(WORKER_ROW);
    expect(parsed.subagentCounts.claudeByIssueUrl[ISSUE_URL]).toBe(0);
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
      name: 'marks the issue URL unmeasured when metadata is wrapped in braces but is not JSON',
      metadataFiles: { 'broken.meta.json': '{garbage}' },
      createProjects: true,
      claude: undefined,
      unmeasured: [ISSUE_URL],
    },
    {
      name: 'marks the issue URL unmeasured when metadata is truncated JSON',
      metadataFiles: { 'truncated.meta.json': '{"finished": tr' },
      createProjects: true,
      claude: undefined,
      unmeasured: [ISSUE_URL],
    },
    {
      name: 'marks the issue URL unmeasured when metadata parses to an array',
      metadataFiles: { 'array.meta.json': '[]' },
      createProjects: true,
      claude: undefined,
      unmeasured: [ISSUE_URL],
    },
  ])('$name', ({ metadataFiles, createProjects, claude, unmeasured }) => {
    const { parsed } = runFactsCommand({
      metadataFiles,
      createProjects,
      withToken: true,
    });
    expect(parsed.subagentCounts.claudeByIssueUrl[ISSUE_URL]).toBe(claude);
    expect(parsed.unmeasuredIssueUrls).toEqual(unmeasured);
  });
});
