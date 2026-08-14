import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseAllDocuments } from 'yaml';
import {
  ownerCallFileAppend,
  ownerCallFileDelete,
  ownerCallFileDeleteInEveryProject,
  ownerCallFilePath,
  ownerCallProjectCodeInInTmuxByHumanData,
} from './ownerCallFileStore';
import { ownerCallFileRelativePath } from '../../../domain/usecases/intmux/OwnerCallFile';
import { toTmuxSessionName } from '../../../domain/usecases/intmux/InTmuxByHumanSessionReconcileUseCase';

const toPlainValue = (document: { toJS: () => unknown }): unknown =>
  document.toJS();

describe('ownerCallFileStore', () => {
  let dataDir = '';

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-call-store-'));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const sessionName = 'https_//github_com/OWNER/REPO/issues/1';

  it('creates the file and its project directory on the first append', () => {
    ownerCallFileAppend({
      dataDir,
      projectCode: 'umino',
      ownerCall: {
        sessionName,
        calledAt: '2026-08-14T04:22:28Z',
        body: 'the only call\n',
      },
    });

    const filePath = path.join(
      dataDir,
      ownerCallFileRelativePath('umino', sessionName),
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const documents = parseAllDocuments(fs.readFileSync(filePath, 'utf-8'));
    expect(documents).toHaveLength(1);
    expect(documents[0].toJS()).toEqual({
      sessionName,
      calledAt: '2026-08-14T04:22:28Z',
      body: 'the only call\n',
    });
  });

  it('appends a second document after the first one, oldest first', () => {
    ownerCallFileAppend({
      dataDir,
      projectCode: 'umino',
      ownerCall: {
        sessionName,
        calledAt: '2026-08-14T04:22:28Z',
        body: 'the older call\n',
      },
    });
    ownerCallFileAppend({
      dataDir,
      projectCode: 'umino',
      ownerCall: {
        sessionName,
        calledAt: '2026-08-14T05:00:00Z',
        body: 'the newer call\n',
      },
    });

    const documents = parseAllDocuments(
      fs.readFileSync(
        ownerCallFilePath(dataDir, 'umino', sessionName),
        'utf-8',
      ),
    );
    expect(documents.map(toPlainValue)).toEqual([
      {
        sessionName,
        calledAt: '2026-08-14T04:22:28Z',
        body: 'the older call\n',
      },
      {
        sessionName,
        calledAt: '2026-08-14T05:00:00Z',
        body: 'the newer call\n',
      },
    ]);
  });

  it('writes the file of a session that belongs to no project under NA', () => {
    ownerCallFileAppend({
      dataDir,
      projectCode: null,
      ownerCall: {
        sessionName: 'secretary',
        calledAt: '2026-08-14T04:22:28Z',
        body: 'a call from a long running session\n',
      },
    });

    expect(
      fs.existsSync(
        path.join(dataDir, ownerCallFileRelativePath(null, 'secretary')),
      ),
    ).toBe(true);
  });

  it('removes the file of the named project', () => {
    ownerCallFileAppend({
      dataDir,
      projectCode: 'umino',
      ownerCall: {
        sessionName,
        calledAt: '2026-08-14T04:22:28Z',
        body: 'the only call\n',
      },
    });

    ownerCallFileDelete({ dataDir, projectCode: 'umino', sessionName });

    expect(
      fs.existsSync(ownerCallFilePath(dataDir, 'umino', sessionName)),
    ).toBe(false);
  });

  it('succeeds when the file to delete is already absent', () => {
    expect(() =>
      ownerCallFileDelete({ dataDir, projectCode: 'umino', sessionName }),
    ).not.toThrow();
  });

  it('removes the file of a session whose project code the caller does not know', () => {
    ownerCallFileAppend({
      dataDir,
      projectCode: 'umino',
      ownerCall: {
        sessionName,
        calledAt: '2026-08-14T04:22:28Z',
        body: 'the only call\n',
      },
    });
    ownerCallFileAppend({
      dataDir,
      projectCode: 'other',
      ownerCall: {
        sessionName: 'other_session',
        calledAt: '2026-08-14T04:22:28Z',
        body: 'a call of another session\n',
      },
    });

    ownerCallFileDeleteInEveryProject({ dataDir, sessionName });

    expect(
      fs.existsSync(ownerCallFilePath(dataDir, 'umino', sessionName)),
    ).toBe(false);
    expect(
      fs.existsSync(ownerCallFilePath(dataDir, 'other', 'other_session')),
    ).toBe(true);
  });

  it('succeeds when no owner call directory exists at all', () => {
    expect(() =>
      ownerCallFileDeleteInEveryProject({ dataDir, sessionName }),
    ).not.toThrow();
  });
});

describe('ownerCallProjectCodeInInTmuxByHumanData', () => {
  const issueUrl = 'https://github.com/OWNER/REPO/issues/1';
  const otherIssueUrl = 'https://github.com/OWNER/REPO/issues/2';
  let dataDir = '';

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-call-project-'));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const writeProjectData = (projectCode: string, urls: string[]): void => {
    fs.writeFileSync(
      path.join(dataDir, `${projectCode}.v4.json`),
      `${JSON.stringify({
        version: 4,
        overviewUrl: 'https://github.com/orgs/OWNER/projects/1',
        tdpmConsoleUrl: 'http://localhost/projects/code',
        newIssueUrl: 'https://github.com/OWNER/REPO/issues/new',
        groups: [
          {
            story: 'a story',
            sessions: urls.map((url) => ({ name: url, description: 'title' })),
          },
        ],
      })}\n`,
    );
  };

  it('gives the code of the project whose session list holds the session', () => {
    writeProjectData('other', [otherIssueUrl]);
    writeProjectData('umino', [issueUrl]);

    expect(
      ownerCallProjectCodeInInTmuxByHumanData(
        dataDir,
        toTmuxSessionName(issueUrl),
      ),
    ).toBe('umino');
  });

  it('gives null when no project lists the session', () => {
    writeProjectData('umino', [otherIssueUrl]);

    expect(
      ownerCallProjectCodeInInTmuxByHumanData(
        dataDir,
        toTmuxSessionName(issueUrl),
      ),
    ).toBeNull();
  });

  it('gives null when the directory holds no in-tmux-by-human data at all', () => {
    expect(
      ownerCallProjectCodeInInTmuxByHumanData(
        dataDir,
        toTmuxSessionName(issueUrl),
      ),
    ).toBeNull();
  });

  it('gives null when the directory itself is absent', () => {
    expect(
      ownerCallProjectCodeInInTmuxByHumanData(
        path.join(dataDir, 'absent'),
        toTmuxSessionName(issueUrl),
      ),
    ).toBeNull();
  });

  it('reads neither the project index nor the older versions of the project data', () => {
    fs.writeFileSync(
      path.join(dataDir, 'index.v4.json'),
      `${JSON.stringify({
        version: 4,
        projects: [{ name: 'umino', path: '/in-tmux-by-human/umino.v4.json' }],
      })}\n`,
    );
    fs.writeFileSync(
      path.join(dataDir, 'umino.v3.json'),
      `${JSON.stringify({
        version: 3,
        groups: [{ story: 'a story', urls: [{ url: issueUrl, title: 't' }] }],
      })}\n`,
    );

    expect(
      ownerCallProjectCodeInInTmuxByHumanData(
        dataDir,
        toTmuxSessionName(issueUrl),
      ),
    ).toBeNull();
  });

  it('skips a project data file that cannot be read as the expected shape', () => {
    fs.writeFileSync(path.join(dataDir, 'broken.v4.json'), 'not json at all\n');
    fs.writeFileSync(
      path.join(dataDir, 'shapeless.v4.json'),
      `${JSON.stringify({ version: 4, groups: 'not a list' })}\n`,
    );
    writeProjectData('umino', [issueUrl]);

    expect(
      ownerCallProjectCodeInInTmuxByHumanData(
        dataDir,
        toTmuxSessionName(issueUrl),
      ),
    ).toBe('umino');
  });
});
