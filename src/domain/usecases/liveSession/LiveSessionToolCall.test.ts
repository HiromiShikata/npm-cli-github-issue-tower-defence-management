import {
  directChildrenOfTrackedPaths,
  componentsBelowFolder,
  isCredentialLikePath,
  isFolderRefusedForFileRead,
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
      name: 'returns null instead of a guessed URL when the repository part has an underscore that may be a dot',
      sessionName: 'https_//github_com/example-org/example_repo/issues/12',
      knownIssueUrls: ['https://github.com/example-org/other-repo/issues/12'],
      expected: null,
    },
    {
      name: 'returns null when the owner part has an underscore that may be a dot',
      sessionName: 'https_//github_com/example_org/example-repo/issues/12',
      knownIssueUrls: [],
      expected: null,
    },
    {
      name: 'derives the URL from the name when neither part has an underscore and no known URL matches',
      sessionName: 'https_//github_com/example-org/example-repo/issues/12',
      knownIssueUrls: ['https://github.com/example-org/other-repo/issues/12'],
      expected: 'https://github.com/example-org/example-repo/issues/12',
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

describe('isFolderRefusedForFileRead', () => {
  it.each([
    {
      name: 'refuses the root folder',
      folder: '/',
      home: '/home/owner',
      expected: true,
    },
    {
      name: 'refuses the home folder itself',
      folder: '/home/owner',
      home: '/home/owner',
      expected: true,
    },
    {
      name: 'refuses an ancestor of the home folder',
      folder: '/home',
      home: '/home/owner',
      expected: true,
    },
    {
      name: 'allows a folder inside the home folder',
      folder: '/home/owner/repo',
      home: '/home/owner',
      expected: false,
    },
    {
      name: 'allows a sibling that shares a name prefix with home',
      folder: '/home/owner-two',
      home: '/home/owner',
      expected: false,
    },
  ])('$name', ({ folder, home, expected }) => {
    expect(isFolderRefusedForFileRead(folder, home)).toBe(expected);
  });
});

describe('componentsBelowFolder', () => {
  it.each([
    {
      name: 'lists the components below a folder',
      folder: '/work/project',
      target: '/work/project/src/a.ts',
      expected: ['src', 'a.ts'],
    },
    {
      name: 'returns no components for the folder itself',
      folder: '/work/project',
      target: '/work/project',
      expected: [],
    },
    {
      name: 'lists components below the root folder',
      folder: '/',
      target: '/etc/x',
      expected: ['etc', 'x'],
    },
  ])('$name', ({ folder, target, expected }) => {
    expect(componentsBelowFolder(folder, target)).toEqual(expected);
  });
});

describe('isCredentialLikePath', () => {
  it.each([
    {
      name: 'refuses a dot-ssh folder component',
      components: ['.ssh', 'config'],
      expected: true,
    },
    {
      name: 'refuses a dot-env file and its variants',
      components: ['.env.production'],
      expected: true,
    },
    {
      name: 'refuses an id file without an extension',
      components: ['keys', 'id_ed25519'],
      expected: true,
    },
    {
      name: 'allows a public key file',
      components: ['keys', 'id_rsa.pub'],
      expected: false,
    },
    {
      name: 'refuses a key file by extension',
      components: ['certs', 'x.kdbx'],
      expected: true,
    },
    {
      name: 'refuses a gh folder under the config folder',
      components: ['.config', 'gh', 'hosts.yml'],
      expected: true,
    },
    {
      name: 'allows an ordinary file under the config folder',
      components: ['.config', 'app', 'settings.json'],
      expected: false,
    },
    {
      name: 'allows an ordinary repository file',
      components: ['src', 'environment.ts'],
      expected: false,
    },
  ])('$name', ({ components, expected }) => {
    expect(isCredentialLikePath(components)).toBe(expected);
  });
});

describe('credential path rules, case-insensitive and exact', () => {
  it.each([
    {
      name: 'allows a dockerignore file by its exact name',
      components: ['.dockerignore'],
      expected: false,
    },
    {
      name: 'allows an azure pipelines file by its exact name',
      components: ['.azure-pipelines.yml'],
      expected: false,
    },
    {
      name: 'refuses an upper-case key extension',
      components: ['server.PEM'],
      expected: true,
    },
    { name: 'refuses an envrc file', components: ['.envrc'], expected: true },
    {
      name: 'refuses an id file with a backup extension',
      components: ['id_rsa.bak'],
      expected: true,
    },
    {
      name: 'refuses a gh file under config by stem',
      components: ['.config', 'gh.yml'],
      expected: true,
    },
    {
      name: 'refuses an upper-case credential folder name',
      components: ['.AWS', 'credentials'],
      expected: true,
    },
    {
      name: 'refuses a git metadata component',
      components: ['repo', '.git', 'config'],
      expected: true,
    },
  ])('$name', ({ components, expected }) => {
    expect(isCredentialLikePath(components)).toBe(expected);
  });
});

describe('directChildrenOfTrackedPaths', () => {
  it.each([
    {
      name: 'lists files and folders directly under the root, folders with a slash',
      tracked: ['README.md', 'src/index.ts', 'src/a/b.ts'],
      directory: [],
      expected: ['README.md', 'src/'],
    },
    {
      name: 'lists only the direct children of a subfolder',
      tracked: ['src/index.ts', 'src/a/b.ts', 'other.ts'],
      directory: ['src'],
      expected: ['a/', 'index.ts'],
    },
    {
      name: 'lists nothing for a folder without tracked files',
      tracked: ['README.md'],
      directory: ['untracked'],
      expected: [],
    },
  ])('$name', ({ tracked, directory, expected }) => {
    expect(directChildrenOfTrackedPaths(tracked, directory)).toEqual(expected);
  });
});
