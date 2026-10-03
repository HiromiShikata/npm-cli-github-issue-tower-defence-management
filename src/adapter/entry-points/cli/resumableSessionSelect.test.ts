import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resumableSessionSelect } from './resumableSessionSelect';

const sessionName =
  'https://github.com/example-org/example-repo/issues/42/developer';
const olderModificationTimeSeconds = 1790000000;
const newerModificationTimeSeconds = 1790000600;
const newestModificationTimeSeconds = 1790001200;
const sourceAccessTimeSeconds = 1790001800;
const entryTimestamp = '2026-09-30T10:00:00.000Z';
const replyTimestamp = '2026-09-30T10:05:00.000Z';
const linuxPathMaximumLength = 4095;

const firstByNameSessionId = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const secondByNameSessionId = '5c4b3a29-1807-4f6e-9d5c-4b3a29180716';
const thirdByNameSessionId = '9e8d7c6b-5a49-4382-a170-6f5e4d3c2b1a';

const directoryPermissionEnforcedTest = process.getuid?.() === 0 ? it.skip : it;

type SessionDirectoryLayout = {
  caseDirectory: string;
  sessionDir: string;
  otherSessionDir: string;
  secondOtherSessionDir: string;
  archiveRoot: string;
};

type AssistantEntry = {
  text: string;
  isSidechain: boolean;
  isApiErrorMessage: boolean;
};

type TranscriptFileFixture = {
  directory: string;
  sessionId: string;
  lines: string[];
  modificationTimeSeconds: number;
};

const customTitleLine = (customTitle: string, sessionId: string): string =>
  JSON.stringify({ type: 'custom-title', customTitle, sessionId });

const queueOperationLine = (
  sessionId: string,
  timestamp: string | number,
): string =>
  JSON.stringify({
    type: 'queue-operation',
    operation: 'enqueue',
    timestamp,
    sessionId,
    content: 'x',
  });

const assistantLine = ({
  text,
  isSidechain,
  isApiErrorMessage,
}: AssistantEntry): string =>
  JSON.stringify({
    type: 'assistant',
    timestamp: replyTimestamp,
    isSidechain,
    ...(isApiErrorMessage ? { isApiErrorMessage: true } : {}),
    message: { content: [{ type: 'text', text }] },
  });

const mainChainReplyLine = assistantLine({
  text: 'working',
  isSidechain: false,
  isApiErrorMessage: false,
});

const mainChainPromptTooLongLine = assistantLine({
  text: 'Prompt is too long',
  isSidechain: false,
  isApiErrorMessage: true,
});

const sidechainPromptTooLongLine = assistantLine({
  text: 'Prompt is too long',
  isSidechain: true,
  isApiErrorMessage: true,
});

const sidechainReplyLine = assistantLine({
  text: 'subagent working',
  isSidechain: true,
  isApiErrorMessage: false,
});

const userLine = JSON.stringify({
  type: 'user',
  timestamp: replyTimestamp,
  isSidechain: false,
  message: { role: 'user', content: 'continue' },
});

const promptTooLongWithoutSidechainFieldLine = JSON.stringify({
  type: 'assistant',
  timestamp: replyTimestamp,
  isApiErrorMessage: true,
  message: { content: [{ type: 'text', text: 'Prompt is too long' }] },
});

const replyWithoutTimestampLine = JSON.stringify({
  type: 'assistant',
  isSidechain: false,
  message: { content: [{ type: 'text', text: 'working' }] },
});

const resumableTranscriptLines = (sessionId: string): string[] => [
  customTitleLine(sessionName, sessionId),
  queueOperationLine(sessionId, entryTimestamp),
  mainChainReplyLine,
];

const promptTooLongTranscriptLines = (sessionId: string): string[] => [
  ...resumableTranscriptLines(sessionId),
  mainChainPromptTooLongLine,
];

const copiedLine = (
  sourceTranscriptFilePath: string,
  sessionDir: string,
): string =>
  `Session resumption: copied ${sourceTranscriptFilePath} into ${sessionDir} (original kept)`;

const copyFailedLine = (
  sourceTranscriptFilePath: string,
  sessionDir: string,
): string =>
  `Session resumption: could not copy ${sourceTranscriptFilePath} into ${sessionDir}; starting a new session`;

const sessionIdDirectoryCopyWarningLine = (
  sourceSessionIdDirectory: string,
  sessionDir: string,
): string =>
  `Session resumption: warning: could not copy session directory ${sourceSessionIdDirectory} into ${sessionDir}`;

const noEntryTimeLine = (sessionId: string): string =>
  `Session resumption: ${sessionId} has no entry time to compare with the definitions; starting a new session`;

describe('resumableSessionSelect', () => {
  let workingDirectory: string;

  beforeEach(() => {
    workingDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'resumable-session-select-'),
    );
  });

  afterEach(() => {
    fs.rmSync(workingDirectory, { force: true, recursive: true });
  });

  const sessionDirectoryLayoutCreate = (
    caseName: string,
  ): SessionDirectoryLayout => {
    const caseDirectory = path.join(workingDirectory, caseName);
    const layout: SessionDirectoryLayout = {
      caseDirectory,
      sessionDir: path.join(caseDirectory, 'projects', '-work-example-repo'),
      otherSessionDir: path.join(
        caseDirectory,
        'projects',
        '-work-example-repo-worktree-1',
      ),
      secondOtherSessionDir: path.join(
        caseDirectory,
        'projects',
        '-work-example-repo-worktree-2',
      ),
      archiveRoot: path.join(caseDirectory, 'archived-sessions'),
    };
    fs.mkdirSync(layout.sessionDir, { recursive: true });
    return layout;
  };

  const transcriptFileWrite = (fixture: TranscriptFileFixture): string => {
    fs.mkdirSync(fixture.directory, { recursive: true });
    const transcriptFilePath = path.join(
      fixture.directory,
      `${fixture.sessionId}.jsonl`,
    );
    fs.writeFileSync(
      transcriptFilePath,
      `${fixture.lines.join('\n')}\n`,
      'utf8',
    );
    fs.utimesSync(
      transcriptFilePath,
      fixture.modificationTimeSeconds,
      fixture.modificationTimeSeconds,
    );
    return transcriptFilePath;
  };

  const archivedTranscriptFileWrite = (
    archiveRoot: string,
    archiveSubdirectoryName: string | null,
    sessionId: string,
  ): void => {
    const archiveDirectory =
      archiveSubdirectoryName === null
        ? archiveRoot
        : path.join(archiveRoot, archiveSubdirectoryName);
    fs.mkdirSync(archiveDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(archiveDirectory, `${sessionId}.jsonl`),
      'archived transcript file\n',
      'utf8',
    );
  };

  const directoryEntryNames = (directory: string): string[] =>
    fs.existsSync(directory) ? fs.readdirSync(directory).sort() : [];

  it('resumes the only matching transcript file in the session directory without writing a stderr line', () => {
    const layout = sessionDirectoryLayoutCreate('single-transcript-file');
    transcriptFileWrite({
      directory: layout.sessionDir,
      sessionId: secondByNameSessionId,
      lines: resumableTranscriptLines(secondByNameSessionId),
      modificationTimeSeconds: olderModificationTimeSeconds,
    });

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: layout.sessionDir,
      otherSessionDirs: [],
      archiveRoot: layout.archiveRoot,
    });

    expect(output).toEqual({
      stdout: secondByNameSessionId,
      stderrLines: [],
      exitCode: 0,
    });
  });

  it('starts a new claude session when no transcript file in the session directory carries the session name in its first line', () => {
    const cases: {
      description: string;
      arrange: (layout: SessionDirectoryLayout) => string;
    }[] = [
      {
        description:
          'the only transcript file is titled with the session name followed by a suffix',
        arrange: (layout) => {
          transcriptFileWrite({
            directory: layout.sessionDir,
            sessionId: secondByNameSessionId,
            lines: [
              customTitleLine(`${sessionName}-other`, secondByNameSessionId),
              queueOperationLine(secondByNameSessionId, entryTimestamp),
              mainChainReplyLine,
            ],
            modificationTimeSeconds: olderModificationTimeSeconds,
          });
          return layout.sessionDir;
        },
      },
      {
        description: 'the only transcript file is titled with another task',
        arrange: (layout) => {
          transcriptFileWrite({
            directory: layout.sessionDir,
            sessionId: secondByNameSessionId,
            lines: [
              customTitleLine(
                'https://github.com/example-org/example-repo/issues/43/developer',
                secondByNameSessionId,
              ),
              queueOperationLine(secondByNameSessionId, entryTimestamp),
              mainChainReplyLine,
            ],
            modificationTimeSeconds: olderModificationTimeSeconds,
          });
          return layout.sessionDir;
        },
      },
      {
        description:
          'the only transcript file carries the session name on its second line',
        arrange: (layout) => {
          transcriptFileWrite({
            directory: layout.sessionDir,
            sessionId: secondByNameSessionId,
            lines: [
              queueOperationLine(secondByNameSessionId, entryTimestamp),
              customTitleLine(sessionName, secondByNameSessionId),
              mainChainReplyLine,
            ],
            modificationTimeSeconds: olderModificationTimeSeconds,
          });
          return layout.sessionDir;
        },
      },
      {
        description: 'the session directory holds no transcript file',
        arrange: (layout) => layout.sessionDir,
      },
      {
        description: 'the session directory is absent',
        arrange: (layout) => path.join(layout.caseDirectory, 'absent'),
      },
    ];

    cases.forEach(({ description, arrange }, caseIndex) => {
      const layout = sessionDirectoryLayoutCreate(`no-match-${caseIndex}`);
      const sessionDir = arrange(layout);

      const output = resumableSessionSelect({
        sessionName,
        sessionDir,
        otherSessionDirs: [],
        archiveRoot: layout.archiveRoot,
      });

      expect({ description, output }).toEqual({
        description,
        output: { stdout: null, stderrLines: [], exitCode: 0 },
      });
    });
  });

  it('ignores directory entries that are not transcript files', () => {
    const cases: {
      description: string;
      arrange: (sessionDir: string) => void;
    }[] = [
      {
        description: 'a matching file whose name starts with a dot',
        arrange: (sessionDir) => {
          transcriptFileWrite({
            directory: sessionDir,
            sessionId: `.${thirdByNameSessionId}`,
            lines: resumableTranscriptLines(thirdByNameSessionId),
            modificationTimeSeconds: newestModificationTimeSeconds,
          });
        },
      },
      {
        description: 'a directory whose name ends in .jsonl',
        arrange: (sessionDir) => {
          const directoryPath = path.join(
            sessionDir,
            `${thirdByNameSessionId}.jsonl`,
          );
          fs.mkdirSync(directoryPath);
          fs.utimesSync(
            directoryPath,
            newestModificationTimeSeconds,
            newestModificationTimeSeconds,
          );
        },
      },
      {
        description: 'a matching file left with the .jsonl.copying suffix',
        arrange: (sessionDir) => {
          const copyingPath = path.join(
            sessionDir,
            `${thirdByNameSessionId}.jsonl.copying`,
          );
          fs.writeFileSync(
            copyingPath,
            `${resumableTranscriptLines(thirdByNameSessionId).join('\n')}\n`,
            'utf8',
          );
          fs.utimesSync(
            copyingPath,
            newestModificationTimeSeconds,
            newestModificationTimeSeconds,
          );
        },
      },
      {
        description: 'a matching file with the .json suffix',
        arrange: (sessionDir) => {
          const jsonPath = path.join(
            sessionDir,
            `${thirdByNameSessionId}.json`,
          );
          fs.writeFileSync(
            jsonPath,
            `${resumableTranscriptLines(thirdByNameSessionId).join('\n')}\n`,
            'utf8',
          );
          fs.utimesSync(
            jsonPath,
            newestModificationTimeSeconds,
            newestModificationTimeSeconds,
          );
        },
      },
    ];

    cases.forEach(({ description, arrange }, caseIndex) => {
      const layout = sessionDirectoryLayoutCreate(
        `not-a-transcript-file-${caseIndex}`,
      );
      transcriptFileWrite({
        directory: layout.sessionDir,
        sessionId: secondByNameSessionId,
        lines: resumableTranscriptLines(secondByNameSessionId),
        modificationTimeSeconds: olderModificationTimeSeconds,
      });
      arrange(layout.sessionDir);

      const output = resumableSessionSelect({
        sessionName,
        sessionDir: layout.sessionDir,
        otherSessionDirs: [],
        archiveRoot: layout.archiveRoot,
      });

      expect({ description, output }).toEqual({
        description,
        output: { stdout: secondByNameSessionId, stderrLines: [], exitCode: 0 },
      });
    });
  });

  it('resumes the matching transcript file with the newest modification time, breaking a tie by ascending file name', () => {
    const cases: {
      description: string;
      transcriptFiles: { sessionId: string; modificationTimeSeconds: number }[];
      expectedSessionId: string;
    }[] = [
      {
        description: 'the newer transcript file comes later by file name',
        transcriptFiles: [
          {
            sessionId: firstByNameSessionId,
            modificationTimeSeconds: olderModificationTimeSeconds,
          },
          {
            sessionId: thirdByNameSessionId,
            modificationTimeSeconds: newerModificationTimeSeconds,
          },
        ],
        expectedSessionId: thirdByNameSessionId,
      },
      {
        description: 'the newer transcript file comes first by file name',
        transcriptFiles: [
          {
            sessionId: thirdByNameSessionId,
            modificationTimeSeconds: olderModificationTimeSeconds,
          },
          {
            sessionId: firstByNameSessionId,
            modificationTimeSeconds: newerModificationTimeSeconds,
          },
        ],
        expectedSessionId: firstByNameSessionId,
      },
      {
        description: 'both transcript files share one modification time',
        transcriptFiles: [
          {
            sessionId: thirdByNameSessionId,
            modificationTimeSeconds: newerModificationTimeSeconds,
          },
          {
            sessionId: firstByNameSessionId,
            modificationTimeSeconds: newerModificationTimeSeconds,
          },
        ],
        expectedSessionId: firstByNameSessionId,
      },
    ];

    cases.forEach(
      ({ description, transcriptFiles, expectedSessionId }, caseIndex) => {
        const layout = sessionDirectoryLayoutCreate(`newest-${caseIndex}`);
        transcriptFiles.forEach(({ sessionId, modificationTimeSeconds }) => {
          transcriptFileWrite({
            directory: layout.sessionDir,
            sessionId,
            lines: resumableTranscriptLines(sessionId),
            modificationTimeSeconds,
          });
        });

        const output = resumableSessionSelect({
          sessionName,
          sessionDir: layout.sessionDir,
          otherSessionDirs: [],
          archiveRoot: layout.archiveRoot,
        });

        expect({ description, output }).toEqual({
          description,
          output: { stdout: expectedSessionId, stderrLines: [], exitCode: 0 },
        });
      },
    );
  });

  it('skips an archived newest match and resumes the next newest match', () => {
    const cases: {
      description: string;
      archiveSubdirectoryName: string | null;
    }[] = [
      {
        description: 'archived directly under the archive root',
        archiveSubdirectoryName: null,
      },
      {
        description: 'archived in a directory under the archive root',
        archiveSubdirectoryName: '-work-example-repo',
      },
    ];

    cases.forEach(({ description, archiveSubdirectoryName }, caseIndex) => {
      const layout = sessionDirectoryLayoutCreate(`archived-${caseIndex}`);
      transcriptFileWrite({
        directory: layout.sessionDir,
        sessionId: firstByNameSessionId,
        lines: resumableTranscriptLines(firstByNameSessionId),
        modificationTimeSeconds: newestModificationTimeSeconds,
      });
      transcriptFileWrite({
        directory: layout.sessionDir,
        sessionId: thirdByNameSessionId,
        lines: resumableTranscriptLines(thirdByNameSessionId),
        modificationTimeSeconds: newerModificationTimeSeconds,
      });
      transcriptFileWrite({
        directory: layout.sessionDir,
        sessionId: secondByNameSessionId,
        lines: resumableTranscriptLines(secondByNameSessionId),
        modificationTimeSeconds: olderModificationTimeSeconds,
      });
      archivedTranscriptFileWrite(
        layout.archiveRoot,
        archiveSubdirectoryName,
        firstByNameSessionId,
      );

      const output = resumableSessionSelect({
        sessionName,
        sessionDir: layout.sessionDir,
        otherSessionDirs: [],
        archiveRoot: layout.archiveRoot,
      });

      expect({ description, output }).toEqual({
        description,
        output: { stdout: thirdByNameSessionId, stderrLines: [], exitCode: 0 },
      });
    });
  });

  it('skips a newest match whose last main-chain assistant entry is the Prompt is too long API error', () => {
    const cases: {
      description: string;
      newestTranscriptFileTrailingLines: string[];
      expectedSessionId: string;
    }[] = [
      {
        description: 'ends with the main-chain Prompt is too long API error',
        newestTranscriptFileTrailingLines: [mainChainPromptTooLongLine],
        expectedSessionId: secondByNameSessionId,
      },
      {
        description: 'carries the error on an entry without isSidechain',
        newestTranscriptFileTrailingLines: [
          promptTooLongWithoutSidechainFieldLine,
        ],
        expectedSessionId: secondByNameSessionId,
      },
      {
        description: 'has the error followed by a sidechain reply',
        newestTranscriptFileTrailingLines: [
          mainChainPromptTooLongLine,
          sidechainReplyLine,
        ],
        expectedSessionId: secondByNameSessionId,
      },
      {
        description: 'has the error followed by a user entry',
        newestTranscriptFileTrailingLines: [
          mainChainPromptTooLongLine,
          userLine,
        ],
        expectedSessionId: secondByNameSessionId,
      },
      {
        description:
          'has the error followed by lines that are not JSON objects',
        newestTranscriptFileTrailingLines: [
          mainChainPromptTooLongLine,
          'not json',
          '[1,2,3]',
          '{"type":"assistant","isSidechain":false',
        ],
        expectedSessionId: secondByNameSessionId,
      },
      {
        description: 'has the error followed by a later main-chain reply',
        newestTranscriptFileTrailingLines: [
          mainChainPromptTooLongLine,
          mainChainReplyLine,
        ],
        expectedSessionId: thirdByNameSessionId,
      },
      {
        description: 'carries the error only on a sidechain entry',
        newestTranscriptFileTrailingLines: [sidechainPromptTooLongLine],
        expectedSessionId: thirdByNameSessionId,
      },
      {
        description:
          'ends with the error text on an entry that is not an API error',
        newestTranscriptFileTrailingLines: [
          assistantLine({
            text: 'Prompt is too long',
            isSidechain: false,
            isApiErrorMessage: false,
          }),
        ],
        expectedSessionId: thirdByNameSessionId,
      },
      {
        description: 'ends with an API error carrying another text',
        newestTranscriptFileTrailingLines: [
          assistantLine({
            text: 'API Error: 500 Internal server error',
            isSidechain: false,
            isApiErrorMessage: true,
          }),
        ],
        expectedSessionId: thirdByNameSessionId,
      },
    ];

    cases.forEach(
      (
        { description, newestTranscriptFileTrailingLines, expectedSessionId },
        caseIndex,
      ) => {
        const layout = sessionDirectoryLayoutCreate(
          `prompt-too-long-${caseIndex}`,
        );
        transcriptFileWrite({
          directory: layout.sessionDir,
          sessionId: thirdByNameSessionId,
          lines: [
            ...resumableTranscriptLines(thirdByNameSessionId),
            ...newestTranscriptFileTrailingLines,
          ],
          modificationTimeSeconds: newerModificationTimeSeconds,
        });
        transcriptFileWrite({
          directory: layout.sessionDir,
          sessionId: secondByNameSessionId,
          lines: resumableTranscriptLines(secondByNameSessionId),
          modificationTimeSeconds: olderModificationTimeSeconds,
        });

        const output = resumableSessionSelect({
          sessionName,
          sessionDir: layout.sessionDir,
          otherSessionDirs: [],
          archiveRoot: layout.archiveRoot,
        });

        expect({ description, output }).toEqual({
          description,
          output: { stdout: expectedSessionId, stderrLines: [], exitCode: 0 },
        });
      },
    );
  });

  it('copies a match from another session directory together with its session id directory and resumes it', () => {
    const layout = sessionDirectoryLayoutCreate('copy-from-other');
    transcriptFileWrite({
      directory: layout.sessionDir,
      sessionId: firstByNameSessionId,
      lines: promptTooLongTranscriptLines(firstByNameSessionId),
      modificationTimeSeconds: newestModificationTimeSeconds,
    });
    const sourceTranscriptFilePath = transcriptFileWrite({
      directory: layout.otherSessionDir,
      sessionId: secondByNameSessionId,
      lines: resumableTranscriptLines(secondByNameSessionId),
      modificationTimeSeconds: olderModificationTimeSeconds,
    });
    fs.chmodSync(sourceTranscriptFilePath, 0o640);
    const sourceSessionIdDirectory = path.join(
      layout.otherSessionDir,
      secondByNameSessionId,
    );
    const nestedRelativePath = path.join('subagents', 'agent-5f1e2d3c.jsonl');
    const sourceNestedFilePath = path.join(
      sourceSessionIdDirectory,
      nestedRelativePath,
    );
    fs.mkdirSync(path.dirname(sourceNestedFilePath), { recursive: true });
    fs.writeFileSync(sourceNestedFilePath, 'subagent transcript\n', 'utf8');
    fs.utimesSync(
      sourceNestedFilePath,
      olderModificationTimeSeconds,
      olderModificationTimeSeconds,
    );
    const sourceTranscriptFileContent = fs.readFileSync(
      sourceTranscriptFilePath,
      'utf8',
    );

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: layout.sessionDir,
      otherSessionDirs: [layout.otherSessionDir],
      archiveRoot: layout.archiveRoot,
    });

    expect(output).toEqual({
      stdout: secondByNameSessionId,
      stderrLines: [copiedLine(sourceTranscriptFilePath, layout.sessionDir)],
      exitCode: 0,
    });
    const copiedTranscriptFilePath = path.join(
      layout.sessionDir,
      `${secondByNameSessionId}.jsonl`,
    );
    expect(fs.readFileSync(copiedTranscriptFilePath, 'utf8')).toBe(
      sourceTranscriptFileContent,
    );
    expect(fs.statSync(copiedTranscriptFilePath).mtimeMs).toBe(
      olderModificationTimeSeconds * 1000,
    );
    expect(fs.statSync(copiedTranscriptFilePath).mode & 0o777).toBe(0o640);
    expect(
      fs.existsSync(
        path.join(layout.sessionDir, `${secondByNameSessionId}.jsonl.copying`),
      ),
    ).toBe(false);
    const copiedNestedFilePath = path.join(
      layout.sessionDir,
      secondByNameSessionId,
      nestedRelativePath,
    );
    expect(fs.readFileSync(copiedNestedFilePath, 'utf8')).toBe(
      'subagent transcript\n',
    );
    expect(fs.statSync(copiedNestedFilePath).mtimeMs).toBe(
      olderModificationTimeSeconds * 1000,
    );
    expect(fs.readFileSync(sourceTranscriptFilePath, 'utf8')).toBe(
      sourceTranscriptFileContent,
    );
    expect(fs.readFileSync(sourceNestedFilePath, 'utf8')).toBe(
      'subagent transcript\n',
    );
  });

  it('keeps the source mode, access time and modification time on the transcript file copied from another session directory', () => {
    const layout = sessionDirectoryLayoutCreate('copy-keeps-mode-and-times');
    const sourceTranscriptFilePath = transcriptFileWrite({
      directory: layout.otherSessionDir,
      sessionId: secondByNameSessionId,
      lines: resumableTranscriptLines(secondByNameSessionId),
      modificationTimeSeconds: olderModificationTimeSeconds,
    });
    fs.chmodSync(sourceTranscriptFilePath, 0o640);
    fs.utimesSync(
      sourceTranscriptFilePath,
      sourceAccessTimeSeconds,
      olderModificationTimeSeconds,
    );

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: layout.sessionDir,
      otherSessionDirs: [layout.otherSessionDir],
      archiveRoot: layout.archiveRoot,
    });

    const sourceTranscriptFileStats = fs.statSync(sourceTranscriptFilePath);
    const copiedTranscriptFileStats = fs.statSync(
      path.join(layout.sessionDir, `${secondByNameSessionId}.jsonl`),
    );
    expect(output).toEqual({
      stdout: secondByNameSessionId,
      stderrLines: [copiedLine(sourceTranscriptFilePath, layout.sessionDir)],
      exitCode: 0,
    });
    expect(copiedTranscriptFileStats.mode & 0o777).toBe(
      sourceTranscriptFileStats.mode & 0o777,
    );
    expect(
      Math.abs(
        copiedTranscriptFileStats.mtimeMs - sourceTranscriptFileStats.mtimeMs,
      ),
    ).toBeLessThan(1);
    expect(
      Math.abs(
        copiedTranscriptFileStats.atimeMs - sourceTranscriptFileStats.atimeMs,
      ),
    ).toBeLessThan(1);
    expect({
      mode: sourceTranscriptFileStats.mode & 0o777,
      mtimeMs: sourceTranscriptFileStats.mtimeMs,
    }).toEqual({
      mode: 0o640,
      mtimeMs: olderModificationTimeSeconds * 1000,
    });
  });

  it('creates the absent session directory with mode 700 before copying a match from another session directory', () => {
    const layout = sessionDirectoryLayoutCreate('create-session-dir');
    const absentSessionDir = path.join(
      layout.caseDirectory,
      'projects',
      '-work-example-repo-new-worktree',
    );
    const sourceTranscriptFilePath = transcriptFileWrite({
      directory: layout.otherSessionDir,
      sessionId: secondByNameSessionId,
      lines: resumableTranscriptLines(secondByNameSessionId),
      modificationTimeSeconds: olderModificationTimeSeconds,
    });

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: absentSessionDir,
      otherSessionDirs: [layout.otherSessionDir],
      archiveRoot: layout.archiveRoot,
    });

    expect(output).toEqual({
      stdout: secondByNameSessionId,
      stderrLines: [copiedLine(sourceTranscriptFilePath, absentSessionDir)],
      exitCode: 0,
    });
    expect(fs.statSync(absentSessionDir).mode & 0o777).toBe(0o700);
    expect(directoryEntryNames(absentSessionDir)).toEqual([
      `${secondByNameSessionId}.jsonl`,
    ]);
  });

  it('copies only the transcript file when the other session directory holds no session id directory for it', () => {
    const layout = sessionDirectoryLayoutCreate('copy-transcript-file-only');
    const sourceTranscriptFilePath = transcriptFileWrite({
      directory: layout.otherSessionDir,
      sessionId: secondByNameSessionId,
      lines: resumableTranscriptLines(secondByNameSessionId),
      modificationTimeSeconds: olderModificationTimeSeconds,
    });

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: layout.sessionDir,
      otherSessionDirs: [layout.otherSessionDir],
      archiveRoot: layout.archiveRoot,
    });

    expect(output).toEqual({
      stdout: secondByNameSessionId,
      stderrLines: [copiedLine(sourceTranscriptFilePath, layout.sessionDir)],
      exitCode: 0,
    });
    expect(directoryEntryNames(layout.sessionDir)).toEqual([
      `${secondByNameSessionId}.jsonl`,
    ]);
  });

  it('keeps an existing session id directory in the session directory instead of copying the other one over it', () => {
    const layout = sessionDirectoryLayoutCreate('keep-session-id-directory');
    const sourceTranscriptFilePath = transcriptFileWrite({
      directory: layout.otherSessionDir,
      sessionId: secondByNameSessionId,
      lines: resumableTranscriptLines(secondByNameSessionId),
      modificationTimeSeconds: olderModificationTimeSeconds,
    });
    const sourceSessionIdDirectory = path.join(
      layout.otherSessionDir,
      secondByNameSessionId,
    );
    fs.mkdirSync(sourceSessionIdDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(sourceSessionIdDirectory, 'from-other.txt'),
      'other worktree\n',
      'utf8',
    );
    const existingSessionIdDirectory = path.join(
      layout.sessionDir,
      secondByNameSessionId,
    );
    fs.mkdirSync(existingSessionIdDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(existingSessionIdDirectory, 'already-here.txt'),
      'session worktree\n',
      'utf8',
    );

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: layout.sessionDir,
      otherSessionDirs: [layout.otherSessionDir],
      archiveRoot: layout.archiveRoot,
    });

    expect(output).toEqual({
      stdout: secondByNameSessionId,
      stderrLines: [copiedLine(sourceTranscriptFilePath, layout.sessionDir)],
      exitCode: 0,
    });
    expect(directoryEntryNames(existingSessionIdDirectory)).toEqual([
      'already-here.txt',
    ]);
  });

  it('copies the transcript file and leaves the whole content of an existing session id directory in the session directory unchanged', () => {
    const layout = sessionDirectoryLayoutCreate(
      'existing-session-id-directory-content-kept',
    );
    const sourceTranscriptFilePath = transcriptFileWrite({
      directory: layout.otherSessionDir,
      sessionId: secondByNameSessionId,
      lines: resumableTranscriptLines(secondByNameSessionId),
      modificationTimeSeconds: olderModificationTimeSeconds,
    });
    const sourceTranscriptFileContent = fs.readFileSync(
      sourceTranscriptFilePath,
      'utf8',
    );
    const sourceNestedFilePath = path.join(
      layout.otherSessionDir,
      secondByNameSessionId,
      'subagents',
      'agent-from-other-worktree.jsonl',
    );
    fs.mkdirSync(path.dirname(sourceNestedFilePath), { recursive: true });
    fs.writeFileSync(
      sourceNestedFilePath,
      'other worktree subagent transcript\n',
      'utf8',
    );
    const existingSessionIdDirectory = path.join(
      layout.sessionDir,
      secondByNameSessionId,
    );
    const existingNestedFilePath = path.join(
      existingSessionIdDirectory,
      'subagents',
      'agent-already-here.jsonl',
    );
    fs.mkdirSync(path.dirname(existingNestedFilePath), { recursive: true });
    fs.writeFileSync(
      existingNestedFilePath,
      'session worktree subagent transcript\n',
      'utf8',
    );

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: layout.sessionDir,
      otherSessionDirs: [layout.otherSessionDir],
      archiveRoot: layout.archiveRoot,
    });

    expect(output).toEqual({
      stdout: secondByNameSessionId,
      stderrLines: [copiedLine(sourceTranscriptFilePath, layout.sessionDir)],
      exitCode: 0,
    });
    expect(directoryEntryNames(layout.sessionDir)).toEqual([
      secondByNameSessionId,
      `${secondByNameSessionId}.jsonl`,
    ]);
    expect(
      fs.readFileSync(
        path.join(layout.sessionDir, `${secondByNameSessionId}.jsonl`),
        'utf8',
      ),
    ).toBe(sourceTranscriptFileContent);
    expect(
      fs
        .readdirSync(existingSessionIdDirectory, {
          encoding: 'utf8',
          recursive: true,
        })
        .sort(),
    ).toEqual([
      'subagents',
      path.join('subagents', 'agent-already-here.jsonl'),
    ]);
    expect(fs.readFileSync(existingNestedFilePath, 'utf8')).toBe(
      'session worktree subagent transcript\n',
    );
    expect(fs.readFileSync(sourceNestedFilePath, 'utf8')).toBe(
      'other worktree subagent transcript\n',
    );
  });

  it('resumes the session directory match without copying when another session directory holds a newer match', () => {
    const layout = sessionDirectoryLayoutCreate('session-dir-first');
    transcriptFileWrite({
      directory: layout.sessionDir,
      sessionId: thirdByNameSessionId,
      lines: resumableTranscriptLines(thirdByNameSessionId),
      modificationTimeSeconds: olderModificationTimeSeconds,
    });
    transcriptFileWrite({
      directory: layout.otherSessionDir,
      sessionId: firstByNameSessionId,
      lines: resumableTranscriptLines(firstByNameSessionId),
      modificationTimeSeconds: newestModificationTimeSeconds,
    });

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: layout.sessionDir,
      otherSessionDirs: [layout.otherSessionDir],
      archiveRoot: layout.archiveRoot,
    });

    expect(output).toEqual({
      stdout: thirdByNameSessionId,
      stderrLines: [],
      exitCode: 0,
    });
    expect(directoryEntryNames(layout.sessionDir)).toEqual([
      `${thirdByNameSessionId}.jsonl`,
    ]);
  });

  it('resumes the resuming worktree directory own copy of a session id when a stopped worker left an unarchived copy of that same session id in the worktree it was resuming from', () => {
    const layout = sessionDirectoryLayoutCreate(
      'stopped-worker-leftover-same-session-id',
    );
    transcriptFileWrite({
      directory: layout.sessionDir,
      sessionId: firstByNameSessionId,
      lines: resumableTranscriptLines(firstByNameSessionId),
      modificationTimeSeconds: newerModificationTimeSeconds,
    });
    transcriptFileWrite({
      directory: layout.otherSessionDir,
      sessionId: firstByNameSessionId,
      lines: resumableTranscriptLines(firstByNameSessionId),
      modificationTimeSeconds: newestModificationTimeSeconds,
    });

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: layout.sessionDir,
      otherSessionDirs: [layout.otherSessionDir],
      archiveRoot: layout.archiveRoot,
    });

    expect(output).toEqual({
      stdout: firstByNameSessionId,
      stderrLines: [],
      exitCode: 0,
    });
    expect(directoryEntryNames(layout.sessionDir)).toEqual([
      `${firstByNameSessionId}.jsonl`,
    ]);
    expect(directoryEntryNames(layout.otherSessionDir)).toEqual([
      `${firstByNameSessionId}.jsonl`,
    ]);
  });

  it('starts a new claude session without copying when the only match in another session directory is not resumable', () => {
    const cases: {
      description: string;
      arrange: (layout: SessionDirectoryLayout) => void;
    }[] = [
      {
        description: 'archived directly under the archive root',
        arrange: (layout) => {
          transcriptFileWrite({
            directory: layout.otherSessionDir,
            sessionId: secondByNameSessionId,
            lines: resumableTranscriptLines(secondByNameSessionId),
            modificationTimeSeconds: olderModificationTimeSeconds,
          });
          archivedTranscriptFileWrite(
            layout.archiveRoot,
            null,
            secondByNameSessionId,
          );
        },
      },
      {
        description: 'archived in a directory under the archive root',
        arrange: (layout) => {
          transcriptFileWrite({
            directory: layout.otherSessionDir,
            sessionId: secondByNameSessionId,
            lines: resumableTranscriptLines(secondByNameSessionId),
            modificationTimeSeconds: olderModificationTimeSeconds,
          });
          archivedTranscriptFileWrite(
            layout.archiveRoot,
            '-work-example-repo-worktree-1',
            secondByNameSessionId,
          );
        },
      },
      {
        description: 'ending with the Prompt is too long API error',
        arrange: (layout) => {
          transcriptFileWrite({
            directory: layout.otherSessionDir,
            sessionId: secondByNameSessionId,
            lines: promptTooLongTranscriptLines(secondByNameSessionId),
            modificationTimeSeconds: olderModificationTimeSeconds,
          });
        },
      },
    ];

    cases.forEach(({ description, arrange }, caseIndex) => {
      const layout = sessionDirectoryLayoutCreate(
        `other-not-resumable-${caseIndex}`,
      );
      arrange(layout);

      const output = resumableSessionSelect({
        sessionName,
        sessionDir: layout.sessionDir,
        otherSessionDirs: [layout.otherSessionDir],
        archiveRoot: layout.archiveRoot,
      });

      expect({
        description,
        output,
        sessionDirEntries: directoryEntryNames(layout.sessionDir),
        otherSessionDirEntries: directoryEntryNames(layout.otherSessionDir),
      }).toEqual({
        description,
        output: { stdout: null, stderrLines: [], exitCode: 0 },
        sessionDirEntries: [],
        otherSessionDirEntries: [`${secondByNameSessionId}.jsonl`],
      });
    });
  });

  it('resumes the newest match across all other session directories, breaking a modification time tie by the directory given first and then by ascending file name', () => {
    type OtherSessionDirTranscriptFile = {
      otherSessionDirSelect: (layout: SessionDirectoryLayout) => string;
      sessionId: string;
      modificationTimeSeconds: number;
    };
    const firstGivenOtherSessionDir = (
      layout: SessionDirectoryLayout,
    ): string => layout.otherSessionDir;
    const secondGivenOtherSessionDir = (
      layout: SessionDirectoryLayout,
    ): string => layout.secondOtherSessionDir;
    const cases: {
      description: string;
      transcriptFiles: OtherSessionDirTranscriptFile[];
      expectedSourceOtherSessionDirSelect: (
        layout: SessionDirectoryLayout,
      ) => string;
      expectedSessionId: string;
    }[] = [
      {
        description:
          'the newer match is in the second given other session directory',
        transcriptFiles: [
          {
            otherSessionDirSelect: firstGivenOtherSessionDir,
            sessionId: firstByNameSessionId,
            modificationTimeSeconds: olderModificationTimeSeconds,
          },
          {
            otherSessionDirSelect: secondGivenOtherSessionDir,
            sessionId: thirdByNameSessionId,
            modificationTimeSeconds: newerModificationTimeSeconds,
          },
        ],
        expectedSourceOtherSessionDirSelect: secondGivenOtherSessionDir,
        expectedSessionId: thirdByNameSessionId,
      },
      {
        description:
          'the newer match is in the first given other session directory and comes later by file name',
        transcriptFiles: [
          {
            otherSessionDirSelect: firstGivenOtherSessionDir,
            sessionId: thirdByNameSessionId,
            modificationTimeSeconds: newerModificationTimeSeconds,
          },
          {
            otherSessionDirSelect: secondGivenOtherSessionDir,
            sessionId: firstByNameSessionId,
            modificationTimeSeconds: olderModificationTimeSeconds,
          },
        ],
        expectedSourceOtherSessionDirSelect: firstGivenOtherSessionDir,
        expectedSessionId: thirdByNameSessionId,
      },
      {
        description:
          'the matches in two other session directories share one modification time and the one in the first given directory comes later by file name',
        transcriptFiles: [
          {
            otherSessionDirSelect: firstGivenOtherSessionDir,
            sessionId: thirdByNameSessionId,
            modificationTimeSeconds: newerModificationTimeSeconds,
          },
          {
            otherSessionDirSelect: secondGivenOtherSessionDir,
            sessionId: firstByNameSessionId,
            modificationTimeSeconds: newerModificationTimeSeconds,
          },
        ],
        expectedSourceOtherSessionDirSelect: firstGivenOtherSessionDir,
        expectedSessionId: thirdByNameSessionId,
      },
      {
        description:
          'two matches in the first given other session directory share one modification time',
        transcriptFiles: [
          {
            otherSessionDirSelect: firstGivenOtherSessionDir,
            sessionId: thirdByNameSessionId,
            modificationTimeSeconds: newerModificationTimeSeconds,
          },
          {
            otherSessionDirSelect: firstGivenOtherSessionDir,
            sessionId: firstByNameSessionId,
            modificationTimeSeconds: newerModificationTimeSeconds,
          },
          {
            otherSessionDirSelect: secondGivenOtherSessionDir,
            sessionId: secondByNameSessionId,
            modificationTimeSeconds: olderModificationTimeSeconds,
          },
        ],
        expectedSourceOtherSessionDirSelect: firstGivenOtherSessionDir,
        expectedSessionId: firstByNameSessionId,
      },
      {
        description:
          'two matches in the second given other session directory share the newest modification time',
        transcriptFiles: [
          {
            otherSessionDirSelect: firstGivenOtherSessionDir,
            sessionId: secondByNameSessionId,
            modificationTimeSeconds: olderModificationTimeSeconds,
          },
          {
            otherSessionDirSelect: secondGivenOtherSessionDir,
            sessionId: thirdByNameSessionId,
            modificationTimeSeconds: newerModificationTimeSeconds,
          },
          {
            otherSessionDirSelect: secondGivenOtherSessionDir,
            sessionId: firstByNameSessionId,
            modificationTimeSeconds: newerModificationTimeSeconds,
          },
        ],
        expectedSourceOtherSessionDirSelect: secondGivenOtherSessionDir,
        expectedSessionId: firstByNameSessionId,
      },
    ];

    cases.forEach(
      (
        {
          description,
          transcriptFiles,
          expectedSourceOtherSessionDirSelect,
          expectedSessionId,
        },
        caseIndex,
      ) => {
        const layout = sessionDirectoryLayoutCreate(
          `across-other-session-dirs-${caseIndex}`,
        );
        transcriptFiles.forEach(
          ({ otherSessionDirSelect, sessionId, modificationTimeSeconds }) => {
            transcriptFileWrite({
              directory: otherSessionDirSelect(layout),
              sessionId,
              lines: resumableTranscriptLines(sessionId),
              modificationTimeSeconds,
            });
          },
        );
        const expectedSourceTranscriptFilePath = path.join(
          expectedSourceOtherSessionDirSelect(layout),
          `${expectedSessionId}.jsonl`,
        );

        const output = resumableSessionSelect({
          sessionName,
          sessionDir: layout.sessionDir,
          otherSessionDirs: [
            layout.otherSessionDir,
            layout.secondOtherSessionDir,
          ],
          archiveRoot: layout.archiveRoot,
        });

        expect({
          description,
          output,
          sessionDirEntries: directoryEntryNames(layout.sessionDir),
        }).toEqual({
          description,
          output: {
            stdout: expectedSessionId,
            stderrLines: [
              copiedLine(expectedSourceTranscriptFilePath, layout.sessionDir),
            ],
            exitCode: 0,
          },
          sessionDirEntries: [`${expectedSessionId}.jsonl`],
        });
      },
    );
  });

  it('starts a new claude session and reports the transcript file copy failure when the session directory cannot be created', () => {
    const layout = sessionDirectoryLayoutCreate('session-dir-uncreatable');
    const regularFilePath = path.join(layout.caseDirectory, 'regular-file');
    fs.writeFileSync(regularFilePath, 'not a directory\n', 'utf8');
    const uncreatableSessionDir = path.join(regularFilePath, 'sessions');
    const sourceTranscriptFilePath = transcriptFileWrite({
      directory: layout.otherSessionDir,
      sessionId: secondByNameSessionId,
      lines: resumableTranscriptLines(secondByNameSessionId),
      modificationTimeSeconds: olderModificationTimeSeconds,
    });

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: uncreatableSessionDir,
      otherSessionDirs: [layout.otherSessionDir],
      archiveRoot: layout.archiveRoot,
    });

    expect(output).toEqual({
      stdout: null,
      stderrLines: [
        copyFailedLine(sourceTranscriptFilePath, uncreatableSessionDir),
      ],
      exitCode: 0,
    });
    expect(fs.statSync(regularFilePath).isFile()).toBe(true);
    expect(directoryEntryNames(layout.otherSessionDir)).toEqual([
      `${secondByNameSessionId}.jsonl`,
    ]);
  });

  directoryPermissionEnforcedTest(
    'starts a new claude session and reports the transcript file copy failure when the existing session directory is not writable',
    () => {
      const layout = sessionDirectoryLayoutCreate('session-dir-not-writable');
      const sourceTranscriptFilePath = transcriptFileWrite({
        directory: layout.otherSessionDir,
        sessionId: secondByNameSessionId,
        lines: resumableTranscriptLines(secondByNameSessionId),
        modificationTimeSeconds: olderModificationTimeSeconds,
      });
      const sourceTranscriptFileContent = fs.readFileSync(
        sourceTranscriptFilePath,
        'utf8',
      );
      const sourceTranscriptFileMode = fs.statSync(
        sourceTranscriptFilePath,
      ).mode;
      fs.chmodSync(layout.sessionDir, 0o500);

      try {
        const output = resumableSessionSelect({
          sessionName,
          sessionDir: layout.sessionDir,
          otherSessionDirs: [layout.otherSessionDir],
          archiveRoot: layout.archiveRoot,
        });

        expect(output).toEqual({
          stdout: null,
          stderrLines: [
            copyFailedLine(sourceTranscriptFilePath, layout.sessionDir),
          ],
          exitCode: 0,
        });
        expect(
          fs.existsSync(
            path.join(layout.sessionDir, `${secondByNameSessionId}.jsonl`),
          ),
        ).toBe(false);
        expect(
          fs.existsSync(
            path.join(
              layout.sessionDir,
              `${secondByNameSessionId}.jsonl.copying`,
            ),
          ),
        ).toBe(false);
        expect(directoryEntryNames(layout.otherSessionDir)).toEqual([
          `${secondByNameSessionId}.jsonl`,
        ]);
        expect(fs.readFileSync(sourceTranscriptFilePath, 'utf8')).toBe(
          sourceTranscriptFileContent,
        );
        expect(fs.statSync(sourceTranscriptFilePath).mode).toBe(
          sourceTranscriptFileMode,
        );
        expect(fs.statSync(sourceTranscriptFilePath).mtimeMs).toBe(
          olderModificationTimeSeconds * 1000,
        );
      } finally {
        fs.chmodSync(layout.sessionDir, 0o700);
      }
    },
  );

  it('resumes the copied transcript file and writes a warning when its session id directory cannot be copied', () => {
    const layout = sessionDirectoryLayoutCreate(
      'session-id-directory-uncopyable',
    );
    const longSessionDir = path.join(
      layout.caseDirectory,
      's'.repeat(250),
      'projects',
      '-work-example-repo',
    );
    fs.mkdirSync(longSessionDir, { recursive: true });
    const shortOtherSessionDir = path.join(layout.caseDirectory, 'o');
    const sourceTranscriptFilePath = transcriptFileWrite({
      directory: shortOtherSessionDir,
      sessionId: secondByNameSessionId,
      lines: resumableTranscriptLines(secondByNameSessionId),
      modificationTimeSeconds: olderModificationTimeSeconds,
    });
    const sourceSessionIdDirectory = path.join(
      shortOtherSessionDir,
      secondByNameSessionId,
    );
    const destinationLengthSurplus =
      longSessionDir.length - shortOtherSessionDir.length;
    let deepestSourceDirectory = sourceSessionIdDirectory;
    let remainingLength =
      linuxPathMaximumLength -
      Math.floor(destinationLengthSurplus / 2) -
      sourceSessionIdDirectory.length;
    while (remainingLength > 202) {
      deepestSourceDirectory = path.join(
        deepestSourceDirectory,
        'n'.repeat(200),
      );
      remainingLength -= 201;
    }
    fs.mkdirSync(deepestSourceDirectory, { recursive: true });
    const deepestSourceFilePath = path.join(
      deepestSourceDirectory,
      'f'.repeat(remainingLength - 1),
    );
    fs.writeFileSync(deepestSourceFilePath, 'tool output\n', 'utf8');
    expect(deepestSourceFilePath.length).toBeLessThanOrEqual(
      linuxPathMaximumLength,
    );
    expect(
      deepestSourceFilePath.length + destinationLengthSurplus,
    ).toBeGreaterThan(linuxPathMaximumLength);

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: longSessionDir,
      otherSessionDirs: [shortOtherSessionDir],
      archiveRoot: layout.archiveRoot,
    });

    expect(output.stdout).toBe(secondByNameSessionId);
    expect(output.exitCode).toBe(0);
    expect(output.stderrLines).toContain(
      sessionIdDirectoryCopyWarningLine(
        sourceSessionIdDirectory,
        longSessionDir,
      ),
    );
    expect(
      fs.readFileSync(
        path.join(longSessionDir, `${secondByNameSessionId}.jsonl`),
        'utf8',
      ),
    ).toBe(fs.readFileSync(sourceTranscriptFilePath, 'utf8'));
    expect(fs.existsSync(sourceTranscriptFilePath)).toBe(true);
    expect(fs.existsSync(deepestSourceFilePath)).toBe(true);
  });

  it('resumes the copied transcript file and writes a warning when its session id directory holds an entry that is neither a regular file, a directory nor a symbolic link', () => {
    const layout = sessionDirectoryLayoutCreate(
      'session-id-directory-holds-named-pipe',
    );
    const sourceTranscriptFilePath = transcriptFileWrite({
      directory: layout.otherSessionDir,
      sessionId: secondByNameSessionId,
      lines: resumableTranscriptLines(secondByNameSessionId),
      modificationTimeSeconds: olderModificationTimeSeconds,
    });
    const sourceTranscriptFileContent = fs.readFileSync(
      sourceTranscriptFilePath,
      'utf8',
    );
    const sourceSessionIdDirectory = path.join(
      layout.otherSessionDir,
      secondByNameSessionId,
    );
    fs.mkdirSync(sourceSessionIdDirectory);
    const namedPipePath = path.join(sourceSessionIdDirectory, 'named-pipe');
    childProcess.execFileSync('mkfifo', [namedPipePath]);

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: layout.sessionDir,
      otherSessionDirs: [layout.otherSessionDir],
      archiveRoot: layout.archiveRoot,
    });

    expect(output).toEqual({
      stdout: secondByNameSessionId,
      stderrLines: [
        sessionIdDirectoryCopyWarningLine(
          sourceSessionIdDirectory,
          layout.sessionDir,
        ),
        copiedLine(sourceTranscriptFilePath, layout.sessionDir),
      ],
      exitCode: 0,
    });
    expect(
      fs.readFileSync(
        path.join(layout.sessionDir, `${secondByNameSessionId}.jsonl`),
        'utf8',
      ),
    ).toBe(sourceTranscriptFileContent);
    expect(fs.statSync(namedPipePath).isFIFO()).toBe(true);
  }, 10000);

  it('starts a new claude session without copying when the selected transcript file has no entry time', () => {
    const cases: {
      description: string;
      newestTranscriptFileLines: string[];
    }[] = [
      {
        description: 'no entry carries a timestamp',
        newestTranscriptFileLines: [
          customTitleLine(sessionName, thirdByNameSessionId),
          replyWithoutTimestampLine,
        ],
      },
      {
        description: 'the timestamp is a number',
        newestTranscriptFileLines: [
          customTitleLine(sessionName, thirdByNameSessionId),
          queueOperationLine(thirdByNameSessionId, 1790000000000),
        ],
      },
      {
        description: 'the timestamp does not parse as a date',
        newestTranscriptFileLines: [
          customTitleLine(sessionName, thirdByNameSessionId),
          queueOperationLine(thirdByNameSessionId, 'not-a-date'),
        ],
      },
      {
        description:
          'the first string timestamp does not parse although a later one does',
        newestTranscriptFileLines: [
          customTitleLine(sessionName, thirdByNameSessionId),
          queueOperationLine(thirdByNameSessionId, 'not-a-date'),
          queueOperationLine(thirdByNameSessionId, entryTimestamp),
          mainChainReplyLine,
        ],
      },
    ];

    cases.forEach(({ description, newestTranscriptFileLines }, caseIndex) => {
      const layout = sessionDirectoryLayoutCreate(`no-entry-time-${caseIndex}`);
      transcriptFileWrite({
        directory: layout.sessionDir,
        sessionId: thirdByNameSessionId,
        lines: newestTranscriptFileLines,
        modificationTimeSeconds: newerModificationTimeSeconds,
      });
      transcriptFileWrite({
        directory: layout.sessionDir,
        sessionId: secondByNameSessionId,
        lines: resumableTranscriptLines(secondByNameSessionId),
        modificationTimeSeconds: olderModificationTimeSeconds,
      });

      const output = resumableSessionSelect({
        sessionName,
        sessionDir: layout.sessionDir,
        otherSessionDirs: [],
        archiveRoot: layout.archiveRoot,
      });

      expect({ description, output }).toEqual({
        description,
        output: {
          stdout: null,
          stderrLines: [noEntryTimeLine(thirdByNameSessionId)],
          exitCode: 0,
        },
      });
    });
  });

  it('starts a new claude session without copying when the match in another session directory has no entry time', () => {
    const layout = sessionDirectoryLayoutCreate('other-no-entry-time');
    transcriptFileWrite({
      directory: layout.otherSessionDir,
      sessionId: secondByNameSessionId,
      lines: [
        customTitleLine(sessionName, secondByNameSessionId),
        replyWithoutTimestampLine,
      ],
      modificationTimeSeconds: olderModificationTimeSeconds,
    });

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: layout.sessionDir,
      otherSessionDirs: [layout.otherSessionDir],
      archiveRoot: layout.archiveRoot,
    });

    expect(output).toEqual({
      stdout: null,
      stderrLines: [noEntryTimeLine(secondByNameSessionId)],
      exitCode: 0,
    });
    expect(directoryEntryNames(layout.sessionDir)).toEqual([]);
  });

  it('does not search another session directory equal to the session directory', () => {
    const layout = sessionDirectoryLayoutCreate('other-equals-session-dir');
    const archivedTranscriptFilePath = transcriptFileWrite({
      directory: layout.sessionDir,
      sessionId: secondByNameSessionId,
      lines: resumableTranscriptLines(secondByNameSessionId),
      modificationTimeSeconds: olderModificationTimeSeconds,
    });
    archivedTranscriptFileWrite(
      layout.archiveRoot,
      null,
      secondByNameSessionId,
    );
    const archivedTranscriptFileContent = fs.readFileSync(
      archivedTranscriptFilePath,
      'utf8',
    );

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: layout.sessionDir,
      otherSessionDirs: [layout.sessionDir],
      archiveRoot: layout.archiveRoot,
    });

    expect(output).toEqual({ stdout: null, stderrLines: [], exitCode: 0 });
    expect(directoryEntryNames(layout.sessionDir)).toEqual([
      `${secondByNameSessionId}.jsonl`,
    ]);
    expect(fs.readFileSync(archivedTranscriptFilePath, 'utf8')).toBe(
      archivedTranscriptFileContent,
    );
  });

  it('does not select a transcript file in another session directory whose file name exists in the session directory', () => {
    const cases: {
      description: string;
      olderOtherSessionId: string | null;
      expectedSessionDirEntries: string[];
    }[] = [
      {
        description:
          'an older resumable match exists in the other session directory',
        olderOtherSessionId: firstByNameSessionId,
        expectedSessionDirEntries: [
          `${firstByNameSessionId}.jsonl`,
          `${thirdByNameSessionId}.jsonl`,
        ],
      },
      {
        description: 'no other match exists in the other session directory',
        olderOtherSessionId: null,
        expectedSessionDirEntries: [`${thirdByNameSessionId}.jsonl`],
      },
    ];

    cases.forEach(
      (
        { description, olderOtherSessionId, expectedSessionDirEntries },
        caseIndex,
      ) => {
        const layout = sessionDirectoryLayoutCreate(
          `name-exists-in-session-dir-${caseIndex}`,
        );
        const sessionDirTranscriptFilePath = transcriptFileWrite({
          directory: layout.sessionDir,
          sessionId: thirdByNameSessionId,
          lines: [
            customTitleLine(
              'https://github.com/example-org/example-repo/issues/43/developer',
              thirdByNameSessionId,
            ),
            queueOperationLine(thirdByNameSessionId, entryTimestamp),
          ],
          modificationTimeSeconds: olderModificationTimeSeconds,
        });
        const sessionDirTranscriptFileContent = fs.readFileSync(
          sessionDirTranscriptFilePath,
          'utf8',
        );
        transcriptFileWrite({
          directory: layout.otherSessionDir,
          sessionId: thirdByNameSessionId,
          lines: resumableTranscriptLines(thirdByNameSessionId),
          modificationTimeSeconds: newestModificationTimeSeconds,
        });
        const olderSourceTranscriptFilePath =
          olderOtherSessionId === null
            ? null
            : transcriptFileWrite({
                directory: layout.otherSessionDir,
                sessionId: olderOtherSessionId,
                lines: resumableTranscriptLines(olderOtherSessionId),
                modificationTimeSeconds: olderModificationTimeSeconds,
              });

        const output = resumableSessionSelect({
          sessionName,
          sessionDir: layout.sessionDir,
          otherSessionDirs: [layout.otherSessionDir],
          archiveRoot: layout.archiveRoot,
        });

        expect({
          description,
          output,
          sessionDirEntries: directoryEntryNames(layout.sessionDir),
          sessionDirTranscriptFileContent: fs.readFileSync(
            sessionDirTranscriptFilePath,
            'utf8',
          ),
        }).toEqual({
          description,
          output: {
            stdout: olderOtherSessionId,
            stderrLines:
              olderSourceTranscriptFilePath === null
                ? []
                : [
                    copiedLine(
                      olderSourceTranscriptFilePath,
                      layout.sessionDir,
                    ),
                  ],
            exitCode: 0,
          },
          sessionDirEntries: expectedSessionDirEntries,
          sessionDirTranscriptFileContent,
        });
      },
    );
  });

  it('starts a new claude session when the session directory already holds a directory named like the selected transcript file', () => {
    const layout = sessionDirectoryLayoutCreate('copy-target-occupied');
    const occupyingDirectoryPath = path.join(
      layout.sessionDir,
      `${secondByNameSessionId}.jsonl`,
    );
    fs.mkdirSync(occupyingDirectoryPath);
    const sourceTranscriptFilePath = transcriptFileWrite({
      directory: layout.otherSessionDir,
      sessionId: secondByNameSessionId,
      lines: resumableTranscriptLines(secondByNameSessionId),
      modificationTimeSeconds: olderModificationTimeSeconds,
    });

    const output = resumableSessionSelect({
      sessionName,
      sessionDir: layout.sessionDir,
      otherSessionDirs: [layout.otherSessionDir],
      archiveRoot: layout.archiveRoot,
    });

    expect(output.stdout).toBeNull();
    expect(output.exitCode).toBe(0);
    expect(fs.statSync(occupyingDirectoryPath).isDirectory()).toBe(true);
    expect(fs.existsSync(sourceTranscriptFilePath)).toBe(true);
  });
});
