import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileOwnerCallFileRepository } from './FileOwnerCallFileRepository';

const ownerCallDocument = (sessionName: string, calledAt: string): string =>
  [
    '---',
    `sessionName: ${JSON.stringify(sessionName)}`,
    `calledAt: ${JSON.stringify(calledAt)}`,
    'body: |2',
    '  body text',
    '',
  ].join('\n');

describe('FileOwnerCallFileRepository.listPendingOwnerCalls', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-call-test-'));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const writeOwnerCall = (
    projectCode: string,
    fileName: string,
    content: string,
  ): void => {
    const directory = path.join(dataDir, 'call-to-user', projectCode);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, fileName), content);
  };

  it('returns the session name and call time of every owner call file across projects', () => {
    writeOwnerCall(
      'AA',
      'https___github_com_example-org_example-repo_issues_12.yaml',
      ownerCallDocument(
        'https_//github_com/example-org/example-repo/issues/12',
        '2026-11-23T01:00:00Z',
      ),
    );
    writeOwnerCall(
      'NA',
      'plain-session.yaml',
      ownerCallDocument('plain-session', '2026-11-23T02:00:00Z'),
    );
    const repository = new FileOwnerCallFileRepository(dataDir);
    expect(repository.listPendingOwnerCalls()).toEqual(
      expect.arrayContaining([
        {
          sessionName: 'https_//github_com/example-org/example-repo/issues/12',
          calledAt: '2026-11-23T01:00:00Z',
        },
        { sessionName: 'plain-session', calledAt: '2026-11-23T02:00:00Z' },
      ]),
    );
    expect(repository.listPendingOwnerCalls()).toHaveLength(2);
  });

  it('skips files that are not owner call yaml documents', () => {
    writeOwnerCall('NA', 'notes.txt', 'not a call');
    expect(
      new FileOwnerCallFileRepository(dataDir).listPendingOwnerCalls(),
    ).toEqual([]);
  });

  it('returns an empty list when there is no owner call directory', () => {
    expect(
      new FileOwnerCallFileRepository(dataDir).listPendingOwnerCalls(),
    ).toEqual([]);
  });

  it('fails with every unreadable owner call file named, not just the first', () => {
    writeOwnerCall('NA', 'broken-one.yaml', 'sessionName: 3\n');
    writeOwnerCall('NA', 'broken-two.yaml', 'calledAt: 1\n');
    writeOwnerCall(
      'NA',
      'valid.yaml',
      ownerCallDocument('valid', '2026-11-23T03:00:00Z'),
    );
    expect(() =>
      new FileOwnerCallFileRepository(dataDir).listPendingOwnerCalls(),
    ).toThrow(
      /owner call files could not be read: NA\/broken-one\.yaml: .*; NA\/broken-two\.yaml: /,
    );
  });
});

describe('FileOwnerCallFileRepository with stray entries', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-call-stray-test-'));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('skips a regular file directly under the owner call root and still returns the calls', () => {
    const root = path.join(dataDir, 'call-to-user');
    fs.mkdirSync(path.join(root, 'NA'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'NA', 'plain-session.yaml'),
      ownerCallDocument('plain-session', '2026-11-23T05:00:00Z'),
    );
    fs.writeFileSync(path.join(root, 'stray-note.txt'), 'not a project folder');
    expect(
      new FileOwnerCallFileRepository(dataDir).listPendingOwnerCalls(),
    ).toEqual([
      { sessionName: 'plain-session', calledAt: '2026-11-23T05:00:00Z' },
    ]);
  });

  it('skips a directory named like an owner call file inside a project folder', () => {
    const projectPath = path.join(dataDir, 'call-to-user', 'NA');
    fs.mkdirSync(path.join(projectPath, 'looks-like-a-call.yaml'), {
      recursive: true,
    });
    expect(
      new FileOwnerCallFileRepository(dataDir).listPendingOwnerCalls(),
    ).toEqual([]);
  });
});
