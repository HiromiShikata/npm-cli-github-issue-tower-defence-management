import * as path from 'node:path';
import {
  type CreateTaskDefaults,
  createStoriesListJsonPath,
  createTaskDefaultsFromStoriesListJson,
  readCreateTaskDefaultsFromFile,
  resolveCreateTaskDefaults,
} from './voiceConsoleCreateTaskDefaults';

const storyEntry = (storyName: string) => ({
  storyName,
  storyOptionId: `option-${storyName}`,
  color: 'blue',
  description: '',
  openItemCount: 0,
  storyViewUrl: null,
  items: [],
});

const storiesListJson = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  pjcode: 'ABC',
  generatedAt: '2026-11-25T00:00:00.000Z',
  statusOptions: [],
  agentOptions: [],
  stories: [storyEntry('Story A')],
  storyOrder: ['Story A'],
  storyColors: {},
  defaultNameWithOwner: 'owner/default-repo',
  ...overrides,
});

const withoutKey = (
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> => {
  const copy = { ...record };
  delete copy[key];
  return copy;
};

describe('resolveCreateTaskDefaults', () => {
  it('returns the default repository and the first story option for each input combination', () => {
    const cases: {
      name: string;
      input: {
        defaultNameWithOwner: string | null;
        storyOptionNames: string[];
      };
      expected: CreateTaskDefaults;
    }[] = [
      {
        name: 'both a default repository and story options give both values',
        input: {
          defaultNameWithOwner: 'owner/repo',
          storyOptionNames: ['Story A', 'Story B'],
        },
        expected: { nameWithOwner: 'owner/repo', storyName: 'Story A' },
      },
      {
        name: 'no default repository and no story options give both null',
        input: { defaultNameWithOwner: null, storyOptionNames: [] },
        expected: { nameWithOwner: null, storyName: null },
      },
      {
        name: 'an empty default repository string is treated as absent',
        input: { defaultNameWithOwner: '', storyOptionNames: ['Story A'] },
        expected: { nameWithOwner: null, storyName: 'Story A' },
      },
      {
        name: 'a default repository with no story options leaves storyName null',
        input: { defaultNameWithOwner: 'owner/repo', storyOptionNames: [] },
        expected: { nameWithOwner: 'owner/repo', storyName: null },
      },
      {
        name: 'an empty first story option is treated as absent and returns null',
        input: { defaultNameWithOwner: 'owner/repo', storyOptionNames: [''] },
        expected: { nameWithOwner: 'owner/repo', storyName: null },
      },
      {
        name: 'an empty first story option is not skipped in favour of a later non-empty option',
        input: {
          defaultNameWithOwner: 'owner/repo',
          storyOptionNames: ['', 'Story B'],
        },
        expected: { nameWithOwner: 'owner/repo', storyName: null },
      },
      {
        name: 'the first story option is taken in the given order, not sorted',
        input: {
          defaultNameWithOwner: null,
          storyOptionNames: ['Story B', 'Story A'],
        },
        expected: { nameWithOwner: null, storyName: 'Story B' },
      },
    ];

    const actual = cases.map((testCase) => ({
      name: testCase.name,
      result: resolveCreateTaskDefaults(testCase.input),
    }));
    expect(actual).toEqual(
      cases.map((testCase) => ({
        name: testCase.name,
        result: testCase.expected,
      })),
    );
  });
});

describe('createTaskDefaultsFromStoriesListJson', () => {
  it('reads defaultNameWithOwner and the first stories[].storyName from a parsed stories list.json', () => {
    const cases: {
      name: string;
      listJson: unknown;
      expected: CreateTaskDefaults;
    }[] = [
      {
        name: 'a valid list gives the stored default repository and the first story in stored order',
        listJson: storiesListJson({
          stories: [storyEntry('Story B'), storyEntry('Story A')],
          storyOrder: ['Story B', 'Story A'],
        }),
        expected: { nameWithOwner: 'owner/default-repo', storyName: 'Story B' },
      },
      {
        name: 'a stored null default repository gives nameWithOwner null while the story still resolves',
        listJson: storiesListJson({ defaultNameWithOwner: null }),
        expected: { nameWithOwner: null, storyName: 'Story A' },
      },
      {
        name: 'a stored default repository written from the first issue is used as stored',
        listJson: storiesListJson({
          defaultNameWithOwner: 'owner/first-issue-repo',
        }),
        expected: {
          nameWithOwner: 'owner/first-issue-repo',
          storyName: 'Story A',
        },
      },
      {
        name: 'a list without the defaultNameWithOwner key gives nameWithOwner null',
        listJson: withoutKey(storiesListJson(), 'defaultNameWithOwner'),
        expected: { nameWithOwner: null, storyName: 'Story A' },
      },
      {
        name: 'an empty stored default repository string gives nameWithOwner null',
        listJson: storiesListJson({ defaultNameWithOwner: '' }),
        expected: { nameWithOwner: null, storyName: 'Story A' },
      },
      {
        name: 'a non-string stored default repository gives nameWithOwner null',
        listJson: storiesListJson({ defaultNameWithOwner: 5 }),
        expected: { nameWithOwner: null, storyName: 'Story A' },
      },
      {
        name: 'an empty stories array gives storyName null while the default repository is kept',
        listJson: storiesListJson({ stories: [], storyOrder: [] }),
        expected: { nameWithOwner: 'owner/default-repo', storyName: null },
      },
      {
        name: 'an empty first story name is treated as absent and gives storyName null',
        listJson: storiesListJson({
          stories: [storyEntry(''), storyEntry('Story B')],
          storyOrder: ['', 'Story B'],
        }),
        expected: { nameWithOwner: 'owner/default-repo', storyName: null },
      },
      {
        name: 'a top-level null is malformed and gives both null',
        listJson: null,
        expected: { nameWithOwner: null, storyName: null },
      },
      {
        name: 'a top-level string is malformed and gives both null',
        listJson: 'owner/default-repo',
        expected: { nameWithOwner: null, storyName: null },
      },
      {
        name: 'a top-level number is malformed and gives both null',
        listJson: 42,
        expected: { nameWithOwner: null, storyName: null },
      },
      {
        name: 'a top-level array is malformed and gives both null',
        listJson: [storiesListJson()],
        expected: { nameWithOwner: null, storyName: null },
      },
      {
        name: 'an object without stories is malformed and gives both null',
        listJson: { defaultNameWithOwner: 'owner/default-repo' },
        expected: { nameWithOwner: null, storyName: null },
      },
      {
        name: 'a non-array stories value is malformed and gives both null',
        listJson: storiesListJson({ stories: 'Story A' }),
        expected: { nameWithOwner: null, storyName: null },
      },
    ];

    const actual = cases.map((testCase) => ({
      name: testCase.name,
      result: createTaskDefaultsFromStoriesListJson(testCase.listJson),
    }));
    expect(actual).toEqual(
      cases.map((testCase) => ({
        name: testCase.name,
        result: testCase.expected,
      })),
    );
  });
});

describe('createStoriesListJsonPath', () => {
  it('joins consoleDataOutputDir, pjcode, stories and list.json for each input', () => {
    const cases = [
      {
        name: 'absolute data directory',
        input: { consoleDataOutputDir: '/data/console', pjcode: 'ABC' },
        expected: path.join('/data/console', 'ABC', 'stories', 'list.json'),
      },
      {
        name: 'relative data directory and a hyphenated pjcode',
        input: { consoleDataOutputDir: 'out', pjcode: 'XYZ-1' },
        expected: path.join('out', 'XYZ-1', 'stories', 'list.json'),
      },
    ];

    const actual = cases.map((testCase) => ({
      name: testCase.name,
      result: createStoriesListJsonPath(testCase.input),
    }));
    expect(actual).toEqual(
      cases.map((testCase) => ({
        name: testCase.name,
        result: testCase.expected,
      })),
    );
  });
});

describe('readCreateTaskDefaultsFromFile', () => {
  it('returns the defaults of the file for each read or parse outcome, and logs only read or parse failures with the path and the thrown error', async () => {
    const storiesListJsonPath = path.join(
      '/data/console',
      'ABC',
      'stories',
      'list.json',
    );
    const enoentError = Object.assign(new Error('no such file'), {
      code: 'ENOENT',
    });
    const eaccesError = Object.assign(new Error('permission denied'), {
      code: 'EACCES',
    });
    const noDefaults: CreateTaskDefaults = {
      nameWithOwner: null,
      storyName: null,
    };
    const cases: Array<{
      name: string;
      readOutcome: { resolves: string } | { rejects: Error };
      expected: {
        result: CreateTaskDefaults;
        logged: Array<{ messageContainsPath: boolean; error: unknown }>;
      };
    }> = [
      {
        name: 'a valid stories list gives its repository and first story',
        readOutcome: {
          resolves: JSON.stringify({
            pjcode: 'ABC',
            defaultNameWithOwner: 'owner/repo',
            stories: [storyEntry('Story A')],
          }),
        },
        expected: {
          result: { nameWithOwner: 'owner/repo', storyName: 'Story A' },
          logged: [],
        },
      },
      {
        name: 'a missing file is the first-run state and is not logged',
        readOutcome: { rejects: enoentError },
        expected: { result: noDefaults, logged: [] },
      },
      {
        name: 'a non-ENOENT read failure gives both null and is logged once',
        readOutcome: { rejects: eaccesError },
        expected: {
          result: noDefaults,
          logged: [{ messageContainsPath: true, error: eaccesError }],
        },
      },
      {
        name: 'text that is not JSON gives both null and is logged once',
        readOutcome: { resolves: '{not json' },
        expected: {
          result: noDefaults,
          logged: [{ messageContainsPath: true, error: expect.any(Error) }],
        },
      },
      {
        name: 'valid JSON that is an array is malformed data and is not logged',
        readOutcome: { resolves: '[]' },
        expected: { result: noDefaults, logged: [] },
      },
      {
        name: 'valid JSON null is malformed data and is not logged',
        readOutcome: { resolves: 'null' },
        expected: { result: noDefaults, logged: [] },
      },
    ];

    const actual = await Promise.all(
      cases.map(async (testCase) => {
        const readTextFile = jest.fn(
          async (_filePath: string): Promise<string> => {
            if ('rejects' in testCase.readOutcome) {
              throw testCase.readOutcome.rejects;
            }
            return testCase.readOutcome.resolves;
          },
        );
        const logError = jest.fn(
          (_message: string, _error: unknown): void => undefined,
        );
        const result = await readCreateTaskDefaultsFromFile({
          storiesListJsonPath,
          readTextFile,
          logError,
        });
        return {
          name: testCase.name,
          result,
          readPaths: readTextFile.mock.calls.map(([filePath]) => filePath),
          logged: logError.mock.calls.map(([message, error]) => ({
            messageContainsPath: message.includes(storiesListJsonPath),
            error,
          })),
        };
      }),
    );
    expect(actual).toEqual(
      cases.map((testCase) => ({
        name: testCase.name,
        result: testCase.expected.result,
        readPaths: [storiesListJsonPath],
        logged: testCase.expected.logged,
      })),
    );
  });
});
