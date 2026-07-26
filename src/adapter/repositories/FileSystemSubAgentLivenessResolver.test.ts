import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemSubAgentLivenessResolver } from './FileSystemSubAgentLivenessResolver';

describe('FileSystemSubAgentLivenessResolver', () => {
  let runtimeRoot: string;
  const cwdSlug = '-home-user-worktrees-issue-9';
  const sessionUuid = 'ba0637e1-9ff1-41a8-b13c-f45e6a71efc5';
  const sessionName = 'https_//github_com/owner/repo/issues/9';
  const mainTranscriptPath = path.join(
    '/home/user/.config/projects',
    cwdSlug,
    `${sessionUuid}.jsonl`,
  );

  beforeEach(() => {
    runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-live-'));
  });

  afterEach(() => {
    fs.rmSync(runtimeRoot, { force: true, recursive: true });
  });

  const writeRunningFile = (contents: string): void => {
    const dir = path.join(runtimeRoot, cwdSlug, sessionUuid);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'running-subagents.txt'), contents, 'utf8');
  };

  it('returns the trimmed non-empty ids listed in running-subagents.txt', async () => {
    writeRunningFile('a70a08e0587d6f484\n\n  ad5d15d239d7e72e8  \n');
    const resolver = new FileSystemSubAgentLivenessResolver(runtimeRoot);

    const result = await resolver.resolveLiveSubAgentIds({
      sessionName,
      mainTranscriptPath,
    });

    expect(result).toEqual(new Set(['a70a08e0587d6f484', 'ad5d15d239d7e72e8']));
  });

  it('returns an empty set when the running file exists but lists no ids', async () => {
    writeRunningFile('\n   \n');
    const resolver = new FileSystemSubAgentLivenessResolver(runtimeRoot);

    const result = await resolver.resolveLiveSubAgentIds({
      sessionName,
      mainTranscriptPath,
    });

    expect(result).toEqual(new Set());
  });

  it('returns null when the running file does not exist', async () => {
    const resolver = new FileSystemSubAgentLivenessResolver(runtimeRoot);

    const result = await resolver.resolveLiveSubAgentIds({
      sessionName,
      mainTranscriptPath,
    });

    expect(result).toBeNull();
  });

  it('returns null when the runtime root directory is null', async () => {
    const resolver = new FileSystemSubAgentLivenessResolver(null);

    const result = await resolver.resolveLiveSubAgentIds({
      sessionName,
      mainTranscriptPath,
    });

    expect(result).toBeNull();
  });

  it('returns null when the main transcript path is null', async () => {
    const resolver = new FileSystemSubAgentLivenessResolver(runtimeRoot);

    const result = await resolver.resolveLiveSubAgentIds({
      sessionName,
      mainTranscriptPath: null,
    });

    expect(result).toBeNull();
  });
});
