import {
  capLiveSessionText,
  isBinaryText,
  isPathInsideFolder,
  lastScreenLines,
  issueUrlOfSessionName,
  joinSessionFolderPath,
  normalizeLiveSessionName,
} from './LiveSessionToolCall';

describe('capLiveSessionText', () => {
  it.each([
    {
      name: 'keeps text within the limit unchanged',
      text: 'abc',
      limitBytes: 10,
      expected: 'abc',
    },
    {
      name: 'cuts text longer than the limit and appends a truncation note',
      text: 'abcdef',
      limitBytes: 3,
      expected: 'abc\n[truncated: output longer than 3 bytes]',
    },
    {
      name: 'never splits a multi-byte character across the cut',
      text: 'あいう',
      limitBytes: 4,
      expected: 'あ\n[truncated: output longer than 4 bytes]',
    },
  ])('$name', ({ text, limitBytes, expected }) => {
    expect(capLiveSessionText(text, limitBytes)).toBe(expected);
  });
});

describe('normalizeLiveSessionName', () => {
  it.each([
    {
      name: 'converts an issue URL into the tmux session name',
      input: 'https://github.com/example-org/example-repo/issues/12',
      expected: 'https_//github_com/example-org/example-repo/issues/12',
    },
    {
      name: 'keeps an existing tmux session name unchanged',
      input: 'https_//github_com/example-org/example-repo/issues/12',
      expected: 'https_//github_com/example-org/example-repo/issues/12',
    },
    {
      name: 'rejects a name containing a shell metacharacter',
      input: 'session; rm -rf /',
      expected: null,
    },
    {
      name: 'rejects a name starting with a hyphen',
      input: '-t',
      expected: null,
    },
    {
      name: 'rejects an empty name',
      input: '   ',
      expected: null,
    },
  ])('$name', ({ input, expected }) => {
    expect(normalizeLiveSessionName(input)).toBe(expected);
  });
});

describe('issueUrlOfSessionName', () => {
  it.each([
    {
      name: 'derives an issue URL from a session name',
      sessionName: 'https_//github_com/example-org/example-repo/issues/12',
      expected: 'https://github.com/example-org/example-repo/issues/12',
    },
    {
      name: 'derives a pull request URL from a session name',
      sessionName: 'https_//github_com/example-org/example-repo/pull/7',
      expected: 'https://github.com/example-org/example-repo/pull/7',
    },
    {
      name: 'returns null for a session name that is not an issue URL',
      sessionName: 'main-session',
      expected: null,
    },
    {
      name: 'returns null for a session name with trailing text',
      sessionName: 'https_//github_com/example-org/example-repo/issues/12/x',
      expected: null,
    },
  ])('$name', ({ sessionName, expected }) => {
    expect(issueUrlOfSessionName(sessionName)).toBe(expected);
  });
});

describe('joinSessionFolderPath', () => {
  it.each([
    {
      name: 'joins a relative path onto the folder',
      folder: '/work/project',
      relativePath: 'src/index.ts',
      expected: '/work/project/src/index.ts',
    },
    {
      name: 'joins onto the root folder without a double slash',
      folder: '/',
      relativePath: 'etc',
      expected: '/etc',
    },
  ])('$name', ({ folder, relativePath, expected }) => {
    expect(joinSessionFolderPath(folder, relativePath)).toBe(expected);
  });
});

describe('isPathInsideFolder', () => {
  it.each([
    {
      name: 'accepts a file inside the folder',
      folder: '/work/project',
      target: '/work/project/src/index.ts',
      expected: true,
    },
    {
      name: 'accepts the folder itself',
      folder: '/work/project',
      target: '/work/project',
      expected: true,
    },
    {
      name: 'rejects a sibling sharing the folder name as a prefix',
      folder: '/work/project',
      target: '/work/project-other/secret',
      expected: false,
    },
    {
      name: 'rejects a path outside the folder',
      folder: '/work/project',
      target: '/etc/passwd',
      expected: false,
    },
    {
      name: 'accepts any absolute path when the folder is the root',
      folder: '/',
      target: '/etc/hosts',
      expected: true,
    },
  ])('$name', ({ folder, target, expected }) => {
    expect(isPathInsideFolder(folder, target)).toBe(expected);
  });
});

describe('isBinaryText', () => {
  it.each([
    {
      name: 'treats text without NUL as text',
      text: 'plain text',
      expected: false,
    },
    {
      name: 'treats text with NUL as binary',
      text: 'a\u0000b',
      expected: true,
    },
  ])('$name', ({ text, expected }) => {
    expect(isBinaryText(text)).toBe(expected);
  });
});

describe('lastScreenLines', () => {
  it.each([
    {
      name: 'returns the last N lines of the text',
      text: 'a\nb\nc\nd',
      lineCount: 2,
      expected: 'c\nd',
    },
    {
      name: 'drops trailing blank rows before counting',
      text: 'a\nb\n\n  \n',
      lineCount: 2,
      expected: 'a\nb',
    },
    {
      name: 'returns every line when there are fewer than N',
      text: 'a\nb\n',
      lineCount: 10,
      expected: 'a\nb',
    },
    {
      name: 'keeps blank rows that sit between content lines',
      text: 'a\n\nb\n\n',
      lineCount: 5,
      expected: 'a\n\nb',
    },
    {
      name: 'returns an empty string for a blank pane',
      text: '\n\n\n',
      lineCount: 3,
      expected: '',
    },
  ])('$name', ({ text, lineCount, expected }) => {
    expect(lastScreenLines(text, lineCount)).toBe(expected);
  });
});

describe('issueUrlOfSessionName with known issue URLs', () => {
  it.each([
    {
      name: 'returns the original dotted URL when a known URL maps to the session name',
      sessionName: 'https_//github_com/example-org/example_repo/issues/12',
      knownIssueUrls: ['https://github.com/example-org/example.repo/issues/12'],
      expected: 'https://github.com/example-org/example.repo/issues/12',
    },
    {
      name: 'picks the known URL whose normalized name matches among several',
      sessionName: 'https_//github_com/example-org/example_repo/issues/12',
      knownIssueUrls: [
        'https://github.com/example-org/other-repo/issues/12',
        'https://github.com/example-org/example.repo/issues/12',
      ],
      expected: 'https://github.com/example-org/example.repo/issues/12',
    },
    {
      name: 'falls back to the name when no known URL maps to it',
      sessionName: 'https_//github_com/example-org/example_repo/issues/12',
      knownIssueUrls: ['https://github.com/example-org/other-repo/issues/12'],
      expected: 'https://github.com/example-org/example_repo/issues/12',
    },
    {
      name: 'returns null for a non-issue name with no known URL',
      sessionName: 'plain-session',
      knownIssueUrls: [],
      expected: null,
    },
  ])('$name', ({ sessionName, knownIssueUrls, expected }) => {
    expect(issueUrlOfSessionName(sessionName, knownIssueUrls)).toBe(expected);
  });
});
