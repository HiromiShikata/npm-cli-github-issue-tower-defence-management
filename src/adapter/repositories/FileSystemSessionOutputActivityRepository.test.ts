import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemSessionOutputActivityRepository } from './FileSystemSessionOutputActivityRepository';

describe('FileSystemSessionOutputActivityRepository', () => {
  let rootDirectory: string;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'session-output-activity-'),
    );
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { force: true, recursive: true });
  });

  const writeOutputFileWithMtime = (
    sessionName: string,
    epochSeconds: number,
  ): void => {
    const fileName = sessionName.replace(/\//g, '_');
    const filePath = path.join(rootDirectory, fileName);
    fs.writeFileSync(filePath, 'output', 'utf8');
    fs.utimesSync(filePath, epochSeconds, epochSeconds);
  };

  it('returns the latest output epoch derived from each session output file mtime', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeOutputFileWithMtime(sessionName, 1700000000);
    const repository = new FileSystemSessionOutputActivityRepository(
      rootDirectory,
    );

    const result = await repository.listSessionOutputActivities([sessionName]);

    expect(result).toEqual([
      { sessionName, lastOutputEpochSeconds: 1700000000 },
    ]);
  });

  it('omits sessions that have no output file', async () => {
    const presentSessionName = 'https_//github_com/owner/repo/issues/9';
    const missingSessionName = 'https_//github_com/owner/repo/issues/10';
    writeOutputFileWithMtime(presentSessionName, 1700000000);
    const repository = new FileSystemSessionOutputActivityRepository(
      rootDirectory,
    );

    const result = await repository.listSessionOutputActivities([
      presentSessionName,
      missingSessionName,
    ]);

    expect(result).toEqual([
      { sessionName: presentSessionName, lastOutputEpochSeconds: 1700000000 },
    ]);
  });

  it('returns an empty list when the root directory does not exist', async () => {
    const repository = new FileSystemSessionOutputActivityRepository(
      path.join(rootDirectory, 'does-not-exist'),
    );

    const result = await repository.listSessionOutputActivities([
      'https_//github_com/owner/repo/issues/9',
    ]);

    expect(result).toEqual([]);
  });

  it('returns an empty list when the root directory is null', async () => {
    const repository = new FileSystemSessionOutputActivityRepository(null);

    const result = await repository.listSessionOutputActivities([
      'https_//github_com/owner/repo/issues/9',
    ]);

    expect(result).toEqual([]);
  });

  it('returns an empty list when no session names are requested', async () => {
    const repository = new FileSystemSessionOutputActivityRepository(
      rootDirectory,
    );

    const result = await repository.listSessionOutputActivities([]);

    expect(result).toEqual([]);
  });
});
