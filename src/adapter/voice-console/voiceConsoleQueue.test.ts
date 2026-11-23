import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
} from '../../domain/usecases/console/GenerateConsoleListsUseCase';
import {
  buildVoiceConsoleQueue,
  VOICE_CONSOLE_QUEUE_TABS,
  VOICE_CONSOLE_TAB_LABELS,
} from './voiceConsoleQueue';

type Tab = 'todo-by-human' | 'prs';

type ListFixture = {
  pjcode: string;
  tab: Tab;
  items: ConsoleListItem[];
};

const statusOptions: ConsoleFieldOption[] = [
  { id: 'opt_todo', name: 'Todo by human', color: 'GRAY' },
  { id: 'opt_aw', name: 'Awaiting Workspace', color: 'GREEN' },
];

const makeItem = (number: number, isPr = false): ConsoleListItem => ({
  number,
  title: `item ${number}`,
  url: `https://github.com/HiromiShikata/example/${isPr ? 'pull' : 'issues'}/${number}`,
  repo: 'example',
  nameWithOwner: 'HiromiShikata/example',
  projectItemId: `PVTI_${number}`,
  itemId: `item_${number}`,
  isPr,
  story: 'Story A',
  status: 'Todo by human',
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-11-01T00:00:00Z',
  relatedOpenPullRequestUrls: [],
});

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-console-queue-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const writeListFiles = (baseDir: string, fixtures: ListFixture[]): void => {
  for (const fixture of fixtures) {
    const tabDir = path.join(baseDir, fixture.pjcode, fixture.tab);
    fs.mkdirSync(tabDir, { recursive: true });
    fs.writeFileSync(
      path.join(tabDir, 'list.json'),
      JSON.stringify({ items: fixture.items, statusOptions }),
    );
  }
};

describe('buildVoiceConsoleQueue', () => {
  it('reads the todo-by-human tab first and the prs tab second', () => {
    expect(VOICE_CONSOLE_QUEUE_TABS).toEqual(['todo-by-human', 'prs']);
  });

  it('orders entries tab-major, across projects in projectPjcodes order, keeping each file order', () => {
    const cases = [
      {
        name: 'two projects with both tabs, one project missing a tab, one project with no folder',
        projectPjcodes: ['xcare', 'umino', 'ghost'],
        fixtures: [
          {
            pjcode: 'xcare',
            tab: 'todo-by-human' as const,
            items: [makeItem(22), makeItem(21)],
          },
          {
            pjcode: 'umino',
            tab: 'todo-by-human' as const,
            items: [makeItem(7)],
          },
          {
            pjcode: 'umino',
            tab: 'prs' as const,
            items: [makeItem(9, true), makeItem(10, true)],
          },
        ],
        expected: [
          ['xcare', 'todo-by-human', 22],
          ['xcare', 'todo-by-human', 21],
          ['umino', 'todo-by-human', 7],
          ['umino', 'prs', 9],
          ['umino', 'prs', 10],
        ],
      },
      {
        name: 'no list files gives no entries',
        projectPjcodes: ['umino'],
        fixtures: [],
        expected: [],
      },
    ];

    for (const testCase of cases) {
      const baseDir = fs.mkdtempSync(path.join(root, 'case-'));
      writeListFiles(baseDir, testCase.fixtures);

      const entries = buildVoiceConsoleQueue({
        consoleDataOutputDir: baseDir,
        projectPjcodes: testCase.projectPjcodes,
      });

      expect({
        name: testCase.name,
        sequence: entries.map((entry) => [
          entry.pjcode,
          entry.tab,
          entry.item.number,
        ]),
      }).toEqual({ name: testCase.name, sequence: testCase.expected });
    }
  });

  it('gives each entry its item and the statusOptions of its list file', () => {
    const item = makeItem(7);
    writeListFiles(root, [
      { pjcode: 'umino', tab: 'todo-by-human', items: [item] },
    ]);

    const entries = buildVoiceConsoleQueue({
      consoleDataOutputDir: root,
      projectPjcodes: ['umino'],
    });

    expect(entries).toEqual([
      {
        pjcode: 'umino',
        tab: 'todo-by-human',
        item,
        statusOptions,
      },
    ]);
  });

  it('throws when a list file holds invalid JSON', () => {
    const tabDir = path.join(root, 'umino', 'todo-by-human');
    fs.mkdirSync(tabDir, { recursive: true });
    fs.writeFileSync(path.join(tabDir, 'list.json'), '{ not json');

    expect(() =>
      buildVoiceConsoleQueue({
        consoleDataOutputDir: root,
        projectPjcodes: ['umino'],
      }),
    ).toThrow();
  });
});

describe('voice console queue tab labels', () => {
  it('labels each queue tab with the owner term shown in the console', () => {
    expect(VOICE_CONSOLE_TAB_LABELS).toEqual({
      'todo-by-human': 'Todo by human',
      prs: 'Awaiting Owner',
    });
  });
});
