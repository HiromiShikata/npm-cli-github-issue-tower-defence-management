import { mock } from 'jest-mock-extended';
import {
  ResumableSessionSelectUseCase,
  ResumableSessionSelectResult,
} from './ResumableSessionSelectUseCase';
import {
  ResumableSessionTranscriptRepository,
  SessionTranscriptFile,
} from './adapter-interfaces/ResumableSessionTranscriptRepository';

const sessionName =
  'https://github.com/example-org/example-repo/issues/42/developer';
const sessionDir = '/projects/-work-example-repo';
const otherSessionDir = '/projects/-work-example-repo-worktree-1';
const archiveRoot = '/archived-sessions';
const sessionId = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const now = new Date('2026-09-30T11:05:00.000Z');
const ageWindowMilliseconds = 60 * 60 * 1000;

const transcriptFile: SessionTranscriptFile = {
  sessionId,
  fileName: `${sessionId}.jsonl`,
  filePath: `${sessionDir}/${sessionId}.jsonl`,
  sessionDirectoryPath: sessionDir,
  sessionIdDirectoryPath: `${sessionDir}/${sessionId}`,
  modificationTimeNanoseconds: 1n,
};

const otherTranscriptFile: SessionTranscriptFile = {
  ...transcriptFile,
  filePath: `${otherSessionDir}/${sessionId}.jsonl`,
  sessionDirectoryPath: otherSessionDir,
  sessionIdDirectoryPath: `${otherSessionDir}/${sessionId}`,
};

const customTitleLine = JSON.stringify({
  type: 'custom-title',
  customTitle: sessionName,
  sessionId,
});

const timestampLine = (timestamp: string): string =>
  JSON.stringify({ type: 'queue-operation', timestamp });

const input = {
  now,
  sessionName,
  sessionDir,
  otherSessionDirs: [otherSessionDir],
  archiveRoot,
};

type AgeCase = {
  description: string;
  candidateDirectory: 'session' | 'other';
  ageMilliseconds: number;
  expected: ResumableSessionSelectResult;
  shouldCopy: boolean;
};

describe('ResumableSessionSelectUseCase transcript age window', () => {
  const cases: AgeCase[] = [
    {
      description: 'resumes a session-directory candidate at 59 minutes',
      candidateDirectory: 'session',
      ageMilliseconds: ageWindowMilliseconds - 60 * 1000,
      expected: { type: 'resumedInSessionDir', sessionId },
      shouldCopy: false,
    },
    {
      description:
        'resumes a session-directory candidate at exactly 60 minutes',
      candidateDirectory: 'session',
      ageMilliseconds: ageWindowMilliseconds,
      expected: { type: 'resumedInSessionDir', sessionId },
      shouldCopy: false,
    },
    {
      description: 'rejects a session-directory candidate at 61 minutes',
      candidateDirectory: 'session',
      ageMilliseconds: ageWindowMilliseconds + 60 * 1000,
      expected: { type: 'noResumableSessionTranscriptFile' },
      shouldCopy: false,
    },
    {
      description: 'rejects a stale other-directory candidate',
      candidateDirectory: 'other',
      ageMilliseconds: ageWindowMilliseconds + 60 * 1000,
      expected: { type: 'noResumableSessionTranscriptFile' },
      shouldCopy: false,
    },
    {
      description: 'copies a fresh other-directory candidate',
      candidateDirectory: 'other',
      ageMilliseconds: ageWindowMilliseconds - 60 * 1000,
      expected: {
        type: 'resumedAfterCopy',
        sessionTranscriptFile: otherTranscriptFile,
        sessionIdDirectoryCopyOutcome: 'sourceAbsent',
      },
      shouldCopy: true,
    },
  ];

  it.each(cases)(
    '$description',
    ({ candidateDirectory, ageMilliseconds, expected, shouldCopy }) => {
      const repository = mock<ResumableSessionTranscriptRepository>();
      const candidate =
        candidateDirectory === 'session' ? transcriptFile : otherTranscriptFile;
      const candidateLines = [
        customTitleLine,
        timestampLine(new Date(now.getTime() - ageMilliseconds).toISOString()),
      ];
      repository.listSessionTranscriptFiles.mockImplementation(
        (directoryPath) =>
          directoryPath === candidate.sessionDirectoryPath ? [candidate] : [],
      );
      repository.readFirstLine.mockReturnValue(customTitleLine);
      repository.readLines.mockReturnValue(candidateLines);
      repository.isSessionTranscriptFileArchived.mockReturnValue(false);
      repository.doesEntryExist.mockReturnValue(false);
      repository.isDirectory.mockReturnValue(false);
      repository.copySessionTranscriptFile.mockReturnValue('copied');
      repository.copySessionIdDirectory.mockReturnValue('copied');

      const result = new ResumableSessionSelectUseCase(repository).run({
        ...input,
        otherSessionDirs:
          candidateDirectory === 'other' ? [otherSessionDir] : [],
      });

      expect(result).toEqual(expected);
      if (shouldCopy) {
        expect(repository.copySessionTranscriptFile).toHaveBeenCalledWith(
          otherTranscriptFile,
          sessionDir,
        );
      } else {
        expect(repository.copySessionTranscriptFile).not.toHaveBeenCalled();
      }
    },
  );

  it('does not fall back to a fresh other-directory candidate when the session-directory candidate is stale', () => {
    const repository = mock<ResumableSessionTranscriptRepository>();
    repository.listSessionTranscriptFiles.mockImplementation((directoryPath) =>
      directoryPath === sessionDir ? [transcriptFile] : [otherTranscriptFile],
    );
    repository.readFirstLine.mockReturnValue(customTitleLine);
    repository.readLines.mockImplementation((candidate) => [
      customTitleLine,
      timestampLine(
        new Date(
          now.getTime() +
            (candidate.sessionDirectoryPath === sessionDir
              ? -ageWindowMilliseconds - 60 * 1000
              : -5 * 60 * 1000),
        ).toISOString(),
      ),
    ]);
    repository.isSessionTranscriptFileArchived.mockReturnValue(false);
    repository.doesEntryExist.mockReturnValue(false);

    expect(new ResumableSessionSelectUseCase(repository).run(input)).toEqual({
      type: 'noResumableSessionTranscriptFile',
    });
    expect(repository.copySessionTranscriptFile).not.toHaveBeenCalled();
  });

  it('uses the newest parseable timestamp when the final line is unparseable', () => {
    const repository = mock<ResumableSessionTranscriptRepository>();
    repository.listSessionTranscriptFiles.mockReturnValue([transcriptFile]);
    repository.readFirstLine.mockReturnValue(customTitleLine);
    repository.readLines.mockReturnValue([
      customTitleLine,
      timestampLine(new Date(now.getTime() - 5 * 60 * 1000).toISOString()),
      timestampLine(
        new Date(
          now.getTime() - ageWindowMilliseconds - 60 * 1000,
        ).toISOString(),
      ),
      timestampLine('not a date'),
    ]);
    repository.isSessionTranscriptFileArchived.mockReturnValue(false);

    expect(
      new ResumableSessionSelectUseCase(repository).run({
        ...input,
        otherSessionDirs: [],
      }),
    ).toEqual({ type: 'noResumableSessionTranscriptFile' });
  });

  it('uses the last parseable timestamp in the file', () => {
    const repository = mock<ResumableSessionTranscriptRepository>();
    repository.listSessionTranscriptFiles.mockReturnValue([transcriptFile]);
    repository.readFirstLine.mockReturnValue(customTitleLine);
    repository.readLines.mockReturnValue([
      customTitleLine,
      timestampLine(
        new Date(
          now.getTime() - ageWindowMilliseconds - 60 * 1000,
        ).toISOString(),
      ),
      timestampLine(new Date(now.getTime() - 5 * 60 * 1000).toISOString()),
    ]);
    repository.isSessionTranscriptFileArchived.mockReturnValue(false);

    expect(
      new ResumableSessionSelectUseCase(repository).run({
        ...input,
        otherSessionDirs: [],
      }),
    ).toEqual({ type: 'resumedInSessionDir', sessionId });
  });
});
