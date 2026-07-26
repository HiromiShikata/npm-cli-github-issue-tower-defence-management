import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemSubAgentSilentSecondsResolver } from './FileSystemSubAgentSilentSecondsResolver';

const NOW = new Date('2026-06-26T00:00:00.000Z');
const NOW_EPOCH_SECONDS = Math.floor(NOW.getTime() / 1000);

describe('FileSystemSubAgentSilentSecondsResolver', () => {
  let rootDirectory: string;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-out-'));
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { force: true, recursive: true });
  });

  it('returns 0 when the root directory is not configured', () => {
    const resolver = new FileSystemSubAgentSilentSecondsResolver(null, NOW);
    expect(resolver.resolveSilentSeconds('task-a')).toBe(0);
  });

  it('returns 0 when the output file does not exist', () => {
    const resolver = new FileSystemSubAgentSilentSecondsResolver(
      rootDirectory,
      NOW,
    );
    expect(resolver.resolveSilentSeconds('task-a')).toBe(0);
  });

  it('returns the seconds since the output file was last modified', () => {
    const filePath = path.join(rootDirectory, 'task-a');
    fs.writeFileSync(filePath, 'output', 'utf8');
    const silentEpoch = NOW_EPOCH_SECONDS - 360;
    fs.utimesSync(filePath, silentEpoch, silentEpoch);
    const resolver = new FileSystemSubAgentSilentSecondsResolver(
      rootDirectory,
      NOW,
    );
    expect(resolver.resolveSilentSeconds('task-a')).toBe(360);
  });

  it('replaces slashes in the label when resolving the file name', () => {
    const filePath = path.join(rootDirectory, 'group_task-a');
    fs.writeFileSync(filePath, 'output', 'utf8');
    const silentEpoch = NOW_EPOCH_SECONDS - 120;
    fs.utimesSync(filePath, silentEpoch, silentEpoch);
    const resolver = new FileSystemSubAgentSilentSecondsResolver(
      rootDirectory,
      NOW,
    );
    expect(resolver.resolveSilentSeconds('group/task-a')).toBe(120);
  });
});
