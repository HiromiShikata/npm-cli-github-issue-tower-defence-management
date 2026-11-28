import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  REMOTE_SUBAGENT_FACTS_COMMAND,
  REMOTE_SUBAGENT_FACTS_PERL_MISSING_MARKER,
} from './remoteMachineStatusWriter';

const LEGACY_REMOTE_SUBAGENT_FACTS_COMMAND = `for directory in "\${TDPM_PROC_DIR:-/proc}"/[0-9]*; do
  [ -d "$directory" ] || continue
  pid=\${directory##*/}
  stat=$(cat "$directory/stat" 2>/dev/null) || continue
  ppid=$(printf '%s\\n' "$stat" | sed 's/.*) //; s/^[^ ]* //; s/ .*//')
  argv=$(cat "$directory/cmdline" 2>/dev/null) || continue
  environment=$(cat "$directory/environ" 2>/dev/null || true)
  first=$(cat "$directory/cmdline" | tr '\\0' '\\n' | sed -n '1p')
  if [ "\${first##*/}" = claude ] && tr '\\0' '\\n' < "$directory/cmdline" | awk 'prev == "-p" && /^Take ownership of / { found = 1 } { prev = $0 } END { exit found ? 0 : 1 }'; then
    issueUrl=$(tr '\\0' '\\n' < "$directory/cmdline" | awk 'prev == "-p" && /^Take ownership of / { sub(/^Take ownership of /, ""); print; exit } { prev = $0 }')
    config=$(cat "$directory/environ" | tr '\\0' '\\n' | sed -n 's/^CLAUDE_CONFIG_DIR=//p')
    home=$(cat "$directory/environ" | tr '\\0' '\\n' | sed -n 's/^HOME=//p')
    [ -n "$config" ] || config="$home/.claude"
    session=$(cat "$directory/environ" | tr '\\0' '\\n' | sed -n 's/^CLAUDE_CODE_SESSION_ID=//p')
    printf '%s\\t%s\\tclaude-worker\\t%s\\t-\\n' "$pid" "$ppid" "$issueUrl"
    if ! cat "$directory/environ" >/dev/null 2>&1; then
      printf '%s\\tmeta\\t!\\n' "$pid"
      continue
    fi
    for project in "$config"/projects/*; do
      [ -d "$project" ] || continue
      if [ -n "$session" ]; then sessions="$project/$session"; else sessions="$project"/*; fi
      for sessionDirectory in $sessions; do
        [ -d "$sessionDirectory/subagents" ] || continue
        for meta in "$sessionDirectory/subagents"/*.meta.json; do
          [ -f "$meta" ] || continue
          encoded=$(base64 < "$meta" 2>/dev/null | tr -d '\\n') && [ -n "$encoded" ] || encoded='!'
          printf '%s\\tmeta\\t%s\\n' "$pid" "$encoded"
        done
      done
    done
    continue
  fi
  
if [ "\${first##*/}" = node ] && cat "$directory/cmdline" | tr '\\0' '\\n' | sed -n '2p' | grep -q '/codex$' && [ "$(cat "$directory/cmdline" | tr '\\0' '\\n' | sed -n '3p')" = exec ]; then printf '%s\\t%s\\tcodex-launcher\\t-\\t-\\n' "$pid" "$ppid"; else printf '%s\\t%s\\tother\\t-\\t-\\n' "$pid" "$ppid"; fi; done`;

type Layout = { root: string; proc: string; config: string; home: string };

type ProcessFiles = {
  stat?: string;
  cmdline?: Buffer;
  environ?: Buffer;
};

const ISSUE_URL = 'https://github.com/example-org/example-repo/issues/101';
const OTHER_ISSUE_URL =
  'https://github.com/example-org/example-repo/issues/202';

const statLine = (pid: string, comm: string, ppid: string): string =>
  `${pid} (${comm}) S ${ppid} 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0`;

const nulJoined = (values: string[]): Buffer =>
  Buffer.from(values.map((value) => `${value}\0`).join(''));

const makeLayout = (): Layout => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tdpm-perl-parity-'));
  const layout = {
    root,
    proc: path.join(root, 'proc'),
    config: path.join(root, 'config'),
    home: path.join(root, 'home'),
  };
  for (const directory of [layout.proc, layout.config, layout.home])
    fs.mkdirSync(directory, { recursive: true });
  return layout;
};

const writeProcess = (layout: Layout, pid: string, files: ProcessFiles) => {
  const directory = path.join(layout.proc, pid);
  fs.mkdirSync(directory, { recursive: true });
  if (files.stat !== undefined)
    fs.writeFileSync(path.join(directory, 'stat'), files.stat);
  if (files.cmdline !== undefined)
    fs.writeFileSync(path.join(directory, 'cmdline'), files.cmdline);
  if (files.environ !== undefined)
    fs.writeFileSync(path.join(directory, 'environ'), files.environ);
};

const writeWorker = (
  layout: Layout,
  pid: string,
  ppid: string,
  issueUrl: string,
  environ: string[] | null,
) =>
  writeProcess(layout, pid, {
    stat: statLine(pid, 'claude', ppid),
    cmdline: nulJoined(['claude', '-p', `Take ownership of ${issueUrl}`]),
    environ: environ === null ? undefined : nulJoined(environ),
  });

const writeCodexLauncher = (layout: Layout, pid: string, ppid: string) =>
  writeProcess(layout, pid, {
    stat: statLine(pid, 'node', ppid),
    cmdline: nulJoined(['node', '/usr/local/bin/codex', 'exec']),
    environ: nulJoined([]),
  });

const writeMeta = (
  configDirectory: string,
  project: string,
  session: string,
  name: string,
  content: string | Buffer,
) => {
  const directory = path.join(
    configDirectory,
    'projects',
    project,
    session,
    'subagents',
  );
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, name), content);
};

const runCommand = (
  shell: string,
  command: string,
  procDirectory: string,
  cwd?: string,
): string =>
  execFileSync(shell, ['-c', command], {
    cwd,
    env: {
      PATH: process.env.PATH ?? '',
      LC_ALL: 'C',
      TDPM_PROC_DIR: procDirectory,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const scenarios: { name: string; setup: (layout: Layout) => void }[] = [
  {
    name: 'an active worker with mixed metadata, a Codex launcher and an unrelated process',
    setup: (layout) => {
      writeWorker(layout, '10', '1', ISSUE_URL, [
        `CLAUDE_CONFIG_DIR=${layout.config}`,
        'CLAUDE_CODE_SESSION_ID=session-one',
      ]);
      writeMeta(
        layout.config,
        'demo',
        'session-one',
        'a.meta.json',
        '{"finished":true}',
      );
      writeMeta(
        layout.config,
        'demo',
        'session-one',
        'b.meta.json',
        '{"finished":false}',
      );
      writeMeta(layout.config, 'demo', 'session-one', 'c.meta.json', '{}');
      writeMeta(
        layout.config,
        'demo',
        'session-two',
        'other.meta.json',
        '{"finished":false}',
      );
      writeCodexLauncher(layout, '11', '10');
      writeProcess(layout, '12', {
        stat: statLine('12', 'sleep', '1'),
        cmdline: nulJoined(['sleep', '1']),
        environ: nulJoined([]),
      });
    },
  },
  {
    name: 'no session id, so every session of every visible project is scanned',
    setup: (layout) => {
      writeWorker(layout, '10', '1', ISSUE_URL, [
        `CLAUDE_CONFIG_DIR=${layout.config}`,
      ]);
      writeMeta(
        layout.config,
        'demo',
        'session-one',
        'a.meta.json',
        '{"finished":false}',
      );
      writeMeta(
        layout.config,
        'demo',
        'session-two',
        'b.meta.json',
        '{"finished":true}',
      );
      writeMeta(
        layout.config,
        'demo',
        'session-one',
        '.hidden.meta.json',
        '{"finished":false}',
      );
      writeMeta(
        layout.config,
        '.hidden-project',
        'session-one',
        'h.meta.json',
        '{"finished":false}',
      );
    },
  },
  {
    name: 'the worker environment cannot be read',
    setup: (layout) => {
      writeWorker(layout, '10', '1', OTHER_ISSUE_URL, null);
      writeMeta(
        layout.config,
        'demo',
        'session-one',
        'a.meta.json',
        '{"finished":false}',
      );
      writeCodexLauncher(layout, '11', '10');
    },
  },
  {
    name: 'a command name that contains parentheses',
    setup: (layout) => {
      writeProcess(layout, '10', {
        stat: statLine('10', 'claude (x) y', '7'),
        cmdline: nulJoined(['claude', '-p', `Take ownership of ${ISSUE_URL}`]),
        environ: nulJoined([`CLAUDE_CONFIG_DIR=${layout.config}`]),
      });
    },
  },
  {
    name: 'an empty command line is an other process',
    setup: (layout) => {
      writeProcess(layout, '13', {
        stat: statLine('13', 'kthreadd', '2'),
        cmdline: Buffer.alloc(0),
      });
    },
  },
  {
    name: 'a Node process whose path is not a Codex path',
    setup: (layout) => {
      writeProcess(layout, '14', {
        stat: statLine('14', 'node', '1'),
        cmdline: nulJoined(['node', '/opt/other', 'exec']),
        environ: nulJoined([]),
      });
    },
  },
  {
    name: 'a claude process whose Take ownership argument does not follow -p',
    setup: (layout) => {
      writeProcess(layout, '15', {
        stat: statLine('15', 'claude', '1'),
        cmdline: nulJoined(['claude', `Take ownership of ${ISSUE_URL}`]),
        environ: nulJoined([`CLAUDE_CONFIG_DIR=${layout.config}`]),
      });
    },
  },
  {
    name: 'a claude process with no Take ownership argument',
    setup: (layout) => {
      writeProcess(layout, '16', {
        stat: statLine('16', 'claude', '1'),
        cmdline: nulJoined(['/usr/bin/claude', '-p', 'hello']),
        environ: nulJoined([`CLAUDE_CONFIG_DIR=${layout.config}`]),
      });
    },
  },
  {
    name: 'an empty CLAUDE_CONFIG_DIR, so HOME selects the config directory',
    setup: (layout) => {
      writeWorker(layout, '10', '1', ISSUE_URL, [
        'CLAUDE_CONFIG_DIR=',
        `HOME=${layout.home}`,
      ]);
      writeMeta(
        path.join(layout.home, '.claude'),
        'demo',
        'session-one',
        'a.meta.json',
        '{"finished":false}',
      );
    },
  },
  {
    name: 'CLAUDE_CONFIG_DIR repeated with an empty first value, so the joined value matches no project',
    setup: (layout) => {
      writeWorker(layout, '10', '1', ISSUE_URL, [
        'CLAUDE_CONFIG_DIR=',
        `CLAUDE_CONFIG_DIR=${layout.config}`,
      ]);
      writeMeta(
        layout.config,
        'demo',
        'session-one',
        'a.meta.json',
        '{"finished":false}',
      );
    },
  },
  {
    name: 'an empty metadata file is reported as unreadable',
    setup: (layout) => {
      writeWorker(layout, '10', '1', ISSUE_URL, [
        `CLAUDE_CONFIG_DIR=${layout.config}`,
        'CLAUDE_CODE_SESSION_ID=session-one',
      ]);
      writeMeta(layout.config, 'demo', 'session-one', 'empty.meta.json', '');
    },
  },
  {
    name: 'a metadata entry that is a directory is skipped',
    setup: (layout) => {
      writeWorker(layout, '10', '1', ISSUE_URL, [
        `CLAUDE_CONFIG_DIR=${layout.config}`,
        'CLAUDE_CODE_SESSION_ID=session-one',
      ]);
      fs.mkdirSync(
        path.join(
          layout.config,
          'projects',
          'demo',
          'session-one',
          'subagents',
          'dir.meta.json',
        ),
        { recursive: true },
      );
    },
  },
  {
    name: 'project and session directory names contain spaces, with no session id',
    setup: (layout) => {
      writeWorker(layout, '10', '1', ISSUE_URL, [
        `CLAUDE_CONFIG_DIR=${layout.config}`,
      ]);
      writeMeta(
        layout.config,
        'project with spaces',
        'sess',
        'spaced.meta.json',
        '{"finished":false}',
      );
    },
  },
  {
    name: 'a project directory name contains spaces, with the session id set',
    setup: (layout) => {
      writeWorker(layout, '10', '1', ISSUE_URL, [
        `CLAUDE_CONFIG_DIR=${layout.config}`,
        'CLAUDE_CODE_SESSION_ID=sess',
      ]);
      writeMeta(
        layout.config,
        'project with spaces',
        'sess',
        'spaced.meta.json',
        '{"finished":false}',
      );
    },
  },
  {
    name: 'an unreadable stat file skips the process',
    setup: (layout) => {
      writeProcess(layout, '17', {
        cmdline: nulJoined(['claude', '-p', `Take ownership of ${ISSUE_URL}`]),
        environ: nulJoined([`CLAUDE_CONFIG_DIR=${layout.config}`]),
      });
      writeCodexLauncher(layout, '18', '1');
    },
  },
  {
    name: 'a non-numeric directory and a regular file in the process directory are ignored',
    setup: (layout) => {
      writeProcess(layout, 'abc', {
        stat: statLine('abc', 'node', '1'),
        cmdline: nulJoined(['node', '/usr/bin/x']),
      });
      fs.writeFileSync(path.join(layout.proc, '19'), 'not a directory');
      writeCodexLauncher(layout, '20', '1');
    },
  },
  {
    name: 'metadata that is not JSON is still encoded byte for byte',
    setup: (layout) => {
      writeWorker(layout, '10', '1', ISSUE_URL, [
        `CLAUDE_CONFIG_DIR=${layout.config}`,
        'CLAUDE_CODE_SESSION_ID=session-one',
      ]);
      writeMeta(
        layout.config,
        'demo',
        'session-one',
        'broken.meta.json',
        '{garbage}',
      );
    },
  },
  {
    name: 'binary metadata bytes and metadata longer than one base64 line',
    setup: (layout) => {
      writeWorker(layout, '10', '1', ISSUE_URL, [
        `CLAUDE_CONFIG_DIR=${layout.config}`,
        'CLAUDE_CODE_SESSION_ID=session-one',
      ]);
      writeMeta(
        layout.config,
        'demo',
        'session-one',
        'binary.meta.json',
        Buffer.from([0x00, 0xff, 0x10]),
      );
      writeMeta(
        layout.config,
        'demo',
        'session-one',
        'long.meta.json',
        `{"finished":false,"padding":"${'x'.repeat(300)}"}`,
      );
    },
  },
  {
    name: 'a worker whose Take ownership argument is empty',
    setup: (layout) => {
      writeProcess(layout, '21', {
        stat: statLine('21', 'claude', '1'),
        cmdline: nulJoined(['claude', '-p', 'Take ownership of ']),
        environ: nulJoined([`CLAUDE_CONFIG_DIR=${layout.config}`]),
      });
    },
  },
];

describe('REMOTE_SUBAGENT_FACTS_COMMAND perl output', () => {
  it.each(
    scenarios.flatMap((scenario) =>
      ['sh', 'bash'].map((shell) => ({ ...scenario, shell })),
    ),
  )(
    '$name under $shell prints the same bytes as the shell command',
    ({ setup, shell }) => {
      const layout = makeLayout();
      try {
        setup(layout);
        const expected = runCommand(
          shell,
          LEGACY_REMOTE_SUBAGENT_FACTS_COMMAND,
          layout.proc,
        );
        const actual = runCommand(
          shell,
          REMOTE_SUBAGENT_FACTS_COMMAND,
          layout.proc,
        );
        expect(actual).toBe(expected);
        expect(actual).not.toBe('');
      } finally {
        fs.rmSync(layout.root, { recursive: true, force: true });
      }
    },
  );

  it.each(['sh', 'bash'])(
    'reads a TDPM_PROC_DIR of 0 as a relative directory name under %s, as the shell does',
    (shell) => {
      const layout = makeLayout();
      try {
        writeWorker(layout, '10', '1', ISSUE_URL, [
          `CLAUDE_CONFIG_DIR=${layout.config}`,
        ]);
        fs.renameSync(layout.proc, path.join(layout.root, '0'));
        const expected = runCommand(
          shell,
          LEGACY_REMOTE_SUBAGENT_FACTS_COMMAND,
          '0',
          layout.root,
        );
        const actual = runCommand(
          shell,
          REMOTE_SUBAGENT_FACTS_COMMAND,
          '0',
          layout.root,
        );
        expect(actual).toBe(expected);
        expect(actual).toContain('10\t1\tclaude-worker');
      } finally {
        fs.rmSync(layout.root, { recursive: true, force: true });
      }
    },
  );

  it('prints only the perl-missing marker when perl is not on PATH', () => {
    const output = execFileSync(
      '/bin/sh',
      ['-c', REMOTE_SUBAGENT_FACTS_COMMAND],
      {
        env: { PATH: '' },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    expect(output).toBe(`${REMOTE_SUBAGENT_FACTS_PERL_MISSING_MARKER}\n`);
  });
});
