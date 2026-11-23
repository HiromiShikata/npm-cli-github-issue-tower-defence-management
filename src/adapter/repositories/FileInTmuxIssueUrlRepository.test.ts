import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileInTmuxIssueUrlRepository } from './FileInTmuxIssueUrlRepository';

const projectData = (issueUrls: string[]): string =>
  JSON.stringify({
    version: 4,
    overviewUrl: 'https://example.invalid/overview',
    tdpmConsoleUrl: 'https://example.invalid/console',
    newIssueUrl: 'https://example.invalid/new',
    groups: [
      {
        story: 'example story',
        sessions: issueUrls.map((url) => ({ name: url, description: 'd' })),
      },
    ],
  });

describe('FileInTmuxIssueUrlRepository.listKnownIssueUrls', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'in-tmux-url-test-'));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('returns the original issue URLs of every project data file, including dotted names', () => {
    fs.writeFileSync(
      path.join(dataDir, 'AA.v4.json'),
      projectData(['https://github.com/example-org/example.repo/issues/12']),
    );
    fs.writeFileSync(
      path.join(dataDir, 'BB.v4.json'),
      projectData(['https://github.com/example-org/other-repo/pull/7']),
    );
    expect(
      new FileInTmuxIssueUrlRepository(dataDir).listKnownIssueUrls().sort(),
    ).toEqual([
      'https://github.com/example-org/example.repo/issues/12',
      'https://github.com/example-org/other-repo/pull/7',
    ]);
  });

  it('ignores the index file and other files', () => {
    fs.writeFileSync(
      path.join(dataDir, 'index.v4.json'),
      projectData(['https://github.com/example-org/x/issues/1']),
    );
    fs.writeFileSync(path.join(dataDir, 'notes.txt'), 'not data');
    expect(
      new FileInTmuxIssueUrlRepository(dataDir).listKnownIssueUrls(),
    ).toEqual([]);
  });

  it('accepts an empty groups list and an empty sessions list, as the real data has them', () => {
    fs.writeFileSync(
      path.join(dataDir, 'AA.v4.json'),
      JSON.stringify({ version: 4, groups: [] }),
    );
    fs.writeFileSync(
      path.join(dataDir, 'BB.v4.json'),
      JSON.stringify({
        version: 4,
        groups: [{ story: 'empty', sessions: [] }],
      }),
    );
    expect(
      new FileInTmuxIssueUrlRepository(dataDir).listKnownIssueUrls(),
    ).toEqual([]);
  });

  it.each([
    {
      name: 'a group without a sessions list',
      groups: [{ story: 'no sessions' }],
      reason: 'groups[0] has no sessions list',
    },
    {
      name: 'a session without a string name, after a valid group',
      groups: [
        {
          story: 'ok',
          sessions: [{ name: 'https://github.com/example-org/x/issues/1' }],
        },
        {
          story: 'bad',
          sessions: [
            { name: 'https://github.com/example-org/x/issues/2' },
            { name: 3 },
          ],
        },
      ],
      reason: 'groups[1].sessions[1] has no string name',
    },
  ])(
    'fails naming the file and the position of $name',
    ({ groups, reason }) => {
      fs.writeFileSync(
        path.join(dataDir, 'CC.v4.json'),
        JSON.stringify({ version: 4, groups }),
      );
      expect(() =>
        new FileInTmuxIssueUrlRepository(dataDir).listKnownIssueUrls(),
      ).toThrow(
        `in-tmux project data could not be read: CC.v4.json: ${reason}`,
      );
    },
  );

  it('returns an empty list when the data directory does not exist', () => {
    expect(
      new FileInTmuxIssueUrlRepository(
        path.join(dataDir, 'missing'),
      ).listKnownIssueUrls(),
    ).toEqual([]);
  });

  it('fails with every unreadable project file named', () => {
    fs.writeFileSync(path.join(dataDir, 'DD.v4.json'), '{ not json');
    fs.writeFileSync(
      path.join(dataDir, 'EE.v4.json'),
      JSON.stringify({ version: 4 }),
    );
    expect(() =>
      new FileInTmuxIssueUrlRepository(dataDir).listKnownIssueUrls(),
    ).toThrow(
      /in-tmux project data could not be read: .*DD\.v4\.json.*EE\.v4\.json/,
    );
  });
});
