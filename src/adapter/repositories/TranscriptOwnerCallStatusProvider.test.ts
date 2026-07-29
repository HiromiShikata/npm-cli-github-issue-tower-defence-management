import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  TranscriptOwnerCallStatusProvider,
  ownerCallMarkerFamilyResolve,
} from './TranscriptOwnerCallStatusProvider';
import { SILENT_SESSION_REMINDER_SENTINEL } from '../../domain/usecases/silentSessionReminderSentinel';
import {
  NotifySilentLiveSessionsUseCase,
  DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
  DEFAULT_UNANSWERED_OWNER_CALL_GRACE_SECONDS,
  DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
  DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
  DEFAULT_NOTIFICATION_STAGGER_SECONDS,
  DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS,
  DEFAULT_HUB_TASK_STATUS_CACHE_TTL_SECONDS,
} from '../../domain/usecases/NotifySilentLiveSessionsUseCase';

describe('TranscriptOwnerCallStatusProvider', () => {
  let rootDirectory: string;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'owner-call-status-'),
    );
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { force: true, recursive: true });
  });

  const writeTranscript = (fileName: string, lines: object[]): string => {
    const filePath = path.join(rootDirectory, fileName);
    fs.writeFileSync(
      filePath,
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'utf8',
    );
    return filePath;
  };

  const assistantWithMarker = (timestamp: string): object => ({
    type: 'assistant',
    timestamp,
    message: {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [
        { type: 'text', text: 'Waiting <<OWNER_CALL>> please decide.' },
      ],
    },
  });

  const assistantPlain = (timestamp: string): object => ({
    type: 'assistant',
    timestamp,
    message: {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'progress update' }],
    },
  });

  const ownerReply = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    origin: { kind: 'human' },
    promptSource: 'typed',
    message: { role: 'user', content: 'go ahead' },
  });

  const ownerReplyQueuedNoOrigin = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    promptSource: 'queued',
    message: { role: 'user', content: 'go ahead' },
  });

  const taskNotification = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    origin: { kind: 'task-notification' },
    promptSource: 'system',
    message: {
      role: 'user',
      content:
        '<task-notification>\n<task-id>abc123</task-id>\nA sub-agent finished.\n</task-notification>',
    },
  });

  const peerAgentMessage = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    origin: { kind: 'peer' },
    promptSource: 'system',
    isMeta: true,
    message: {
      role: 'user',
      content: 'Another Claude session sent a message: please continue.',
    },
  });

  const toolResult = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    message: {
      role: 'user',
      content: [{ type: 'tool_result', content: 'ok' }],
    },
  });

  const injectedReminderStringContent = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    message: {
      role: 'user',
      content: `${SILENT_SESSION_REMINDER_SENTINEL} You have produced no output for 10 minutes. Self-check now:`,
    },
  });

  const injectedReminderBlockContent = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    message: {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `${SILENT_SESSION_REMINDER_SENTINEL} The following sub-processes have been silent or running for a long time:`,
        },
      ],
    },
  });

  const sessionName = 'workbench';

  const TERMINATORLESS_MARKER = 'OWNER-CALL';

  it('reports a session as waiting when the last owner call is newer than the last owner reply', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      ownerReply('2026-06-27T10:00:00.000Z'),
      assistantWithMarker('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('exposes the epoch seconds of the unanswered owner call so its age can be computed', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      ownerReply('2026-06-27T10:00:00.000Z'),
      assistantWithMarker('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.get(sessionName)).toBe(
      Math.floor(Date.parse('2026-06-27T10:05:00.000Z') / 1000),
    );
  });

  it('exposes the epoch seconds of the latest owner call when several calls are unanswered', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T09:00:00.000Z'),
      assistantWithMarker('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.get(sessionName)).toBe(
      Math.floor(Date.parse('2026-06-27T10:05:00.000Z') / 1000),
    );
  });

  it('does not report a session as waiting when a later owner reply followed the call', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      ownerReply('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('compares full datetimes rather than only the time of day', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T23:00:00.000Z'),
      ownerReply('2026-06-28T01:00:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('treats tool results as not being owner replies', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      toolResult('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('does not count a monitor-injected reminder with string content as an owner reply', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      injectedReminderStringContent('2026-06-27T10:10:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('does not count a monitor-injected reminder with text-block content as an owner reply', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      injectedReminderBlockContent('2026-06-27T10:10:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('still counts a genuine owner reply that arrives after a monitor-injected reminder', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      injectedReminderStringContent('2026-06-27T10:10:00.000Z'),
      ownerReply('2026-06-27T10:20:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('does not count a system-injected task-notification user entry as an owner reply', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      taskNotification('2026-06-27T10:10:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('does not count a cross-session peer agent message as an owner reply', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      peerAgentMessage('2026-06-27T10:10:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('counts a genuine human reply that has promptSource queued but no origin field', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      ownerReplyQueuedNoOrigin('2026-06-27T10:10:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('counts a genuine human-origin reply that arrives after a task-notification', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      taskNotification('2026-06-27T10:10:00.000Z'),
      ownerReply('2026-06-27T10:20:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('does not report a session that never raised an owner call', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantPlain('2026-06-27T10:00:00.000Z'),
      ownerReply('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('returns an empty map when the marker is null', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      ownerReply('2026-06-27T10:00:00.000Z'),
      assistantWithMarker('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider(null);

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.size).toBe(0);
  });

  it('ignores a session whose transcript file is missing', async () => {
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, path.join(rootDirectory, 'missing.jsonl')]]),
      );

    expect(result.size).toBe(0);
  });

  it('ignores malformed transcript lines', async () => {
    const filePath = path.join(rootDirectory, 'workbench.jsonl');
    fs.writeFileSync(
      filePath,
      [
        'not json',
        JSON.stringify(assistantWithMarker('2026-06-27T10:05:00.000Z')),
      ].join('\n'),
      'utf8',
    );
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, filePath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('detects an owner call raised with the candidate tag family while the configured marker names the legacy literal family', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      ownerReply('2026-06-27T10:00:00.000Z'),
      {
        type: 'assistant',
        timestamp: '2026-06-27T10:05:00.000Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '<call-to-user-pending>Please decide.</call-to-user-pending>',
            },
          ],
        },
      },
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<call-to-user>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.get(sessionName)).toBe(
      Math.floor(Date.parse('2026-06-27T10:05:00.000Z') / 1000),
    );
  });

  it('treats a later genuine owner reply as answering a candidate-tag owner call', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      {
        type: 'assistant',
        timestamp: '2026-06-27T10:00:00.000Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '<call-to-user-pending>Decide.</call-to-user-pending>',
            },
          ],
        },
      },
      ownerReply('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<call-to-user>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('keeps detecting an owner call raised with the legacy literal tag family', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      ownerReply('2026-06-27T10:00:00.000Z'),
      {
        type: 'assistant',
        timestamp: '2026-06-27T10:05:00.000Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '<call-to-user>Please decide.</call-to-user>',
            },
          ],
        },
      },
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<call-to-user>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.get(sessionName)).toBe(
      Math.floor(Date.parse('2026-06-27T10:05:00.000Z') / 1000),
    );
  });

  it('reports the latest call when the legacy tag precedes a candidate tag', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      {
        type: 'assistant',
        timestamp: '2026-06-27T09:00:00.000Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: '<call-to-user>First.</call-to-user>' },
          ],
        },
      },
      {
        type: 'assistant',
        timestamp: '2026-06-27T10:05:00.000Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '<call-to-user-pending>Second.</call-to-user-pending>',
            },
          ],
        },
      },
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<call-to-user>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.get(sessionName)).toBe(
      Math.floor(Date.parse('2026-06-27T10:05:00.000Z') / 1000),
    );
  });

  it('does not treat an unrelated tag that merely shares the marker prefix as an owner call', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      {
        type: 'assistant',
        timestamp: '2026-06-27T10:05:00.000Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '<call-to-user-draft>Not a call.</call-to-user-draft>',
            },
          ],
        },
      },
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<call-to-user>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('treats a marker that does not end with the tag terminator as an owner call marker in its own right', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      {
        type: 'assistant',
        timestamp: '2026-06-27T10:05:00.000Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: `${TERMINATORLESS_MARKER} please decide` },
          ],
        },
      },
    ]);
    const provider = new TranscriptOwnerCallStatusProvider(
      TERMINATORLESS_MARKER,
    );

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.get(sessionName)).toBe(
      Math.floor(Date.parse('2026-06-27T10:05:00.000Z') / 1000),
    );
  });

  it('uses the canonical call-to-user marker string', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      {
        type: 'assistant',
        timestamp: '2026-06-27T10:05:00.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Please decide <call-to-user>' }],
        },
      },
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<call-to-user>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });
});

describe('ownerCallMarkerFamilyResolve', () => {
  const TERMINATORLESS_MARKER = 'OWNER-CALL';
  const CLOSED_TAG_MARKER = `<${TERMINATORLESS_MARKER}>`;

  it('resolves a closed-tag marker to that tag and its candidate form', () => {
    expect(ownerCallMarkerFamilyResolve(CLOSED_TAG_MARKER)).toEqual([
      CLOSED_TAG_MARKER,
      `<${TERMINATORLESS_MARKER}-pending>`,
    ]);
  });

  it('resolves the deployed legacy owner-call tag to both tag families', () => {
    expect(ownerCallMarkerFamilyResolve('<call-to-user>')).toEqual([
      '<call-to-user>',
      '<call-to-user-pending>',
    ]);
  });

  it('resolves a marker that does not end with the tag terminator to that marker alone', () => {
    expect(ownerCallMarkerFamilyResolve(TERMINATORLESS_MARKER)).toEqual([
      TERMINATORLESS_MARKER,
    ]);
  });
});

describe('TranscriptOwnerCallStatusProvider wired into NotifySilentLiveSessionsUseCase', () => {
  let rootDirectory: string;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    rootDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'owner-call-suppression-'),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(rootDirectory, { force: true, recursive: true });
  });

  const now = new Date('2026-06-27T11:00:00.000Z');
  const nowEpochSeconds = Math.floor(now.getTime() / 1000);
  const monitoredSessionName =
    'https_//github_com/HiromiShikata/repo/issues/42';

  class EveryNameRecentSet extends Set<string> {
    override has = (): boolean => true;
  }

  const assistantEntryWith = (text: string): object => ({
    type: 'assistant',
    timestamp: '2026-06-27T10:30:00.000Z',
    message: {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text }],
    },
  });

  const runUseCaseWithTranscript = async (
    entries: object[],
  ): Promise<jest.Mock> => {
    const transcriptPath = path.join(rootDirectory, 'session.jsonl');
    fs.writeFileSync(
      transcriptPath,
      entries.map((entry) => JSON.stringify(entry)).join('\n'),
      'utf8',
    );
    const sendSelfCheckNotification = jest.fn().mockResolvedValue(undefined);
    const useCase = new NotifySilentLiveSessionsUseCase(
      {
        getSnapshot: jest.fn().mockResolvedValue({
          sessions: [{ sessionName: monitoredSessionName, panePids: [100] }],
          processes: [
            {
              pid: 101,
              ppid: 100,
              commandLine: `claude --name ${monitoredSessionName}`,
              sessionId: 'session-uuid',
              currentSessionId: 'session-uuid',
              configDir: '/config/session',
            },
          ],
        }),
      },
      {
        resolveTranscriptPaths: jest
          .fn()
          .mockReturnValue(new Map([[monitoredSessionName, transcriptPath]])),
      },
      {
        listSessionOutputActivities: jest.fn().mockResolvedValue([
          {
            sessionName: monitoredSessionName,
            lastOutputEpochSeconds:
              nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
          },
        ]),
      },
      {
        listSubAgentActivitiesBySessionName: jest
          .fn()
          .mockResolvedValue(new Map()),
      },
      new TranscriptOwnerCallStatusProvider('<call-to-user>'),
      { sendSelfCheckNotification },
      {
        loadRecentCandidateSessionNames: jest
          .fn()
          .mockResolvedValue(new EveryNameRecentSet()),
        saveCandidateSessionNames: jest.fn().mockResolvedValue(undefined),
      },
      {
        loadRecentNotifiedSectionKeys: jest
          .fn()
          .mockResolvedValue(new Set<string>()),
        saveNotifiedSectionKeys: jest.fn().mockResolvedValue(undefined),
      },
      {
        composeMainStalledSection: jest.fn().mockReturnValue('MAIN_STALLED'),
        composeMainStalledWithStaleOwnerCallSection: jest
          .fn()
          .mockReturnValue('MAIN_STALLED_STALE'),
        composeSubAgentSection: jest.fn().mockReturnValue('SUBAGENT'),
        composeSubAgentUnconsumedResultSection: jest
          .fn()
          .mockReturnValue('SUBAGENT_UNCONSUMED_RESULT'),
      },
      { sleep: jest.fn().mockResolvedValue(undefined) },
    );

    await useCase.run({
      mainSilentThresholdSeconds: DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
      unansweredOwnerCallGraceSeconds:
        DEFAULT_UNANSWERED_OWNER_CALL_GRACE_SECONDS,
      subAgentSilentThresholdSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
      subAgentRunningThresholdSeconds:
        DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
      staggerSeconds: DEFAULT_NOTIFICATION_STAGGER_SECONDS,
      candidateDebounceRecencyWindowSeconds:
        DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS,
      activeHubTaskStatus: null,
      hubTaskStatusCacheTtlSeconds: DEFAULT_HUB_TASK_STATUS_CACHE_TTL_SECONDS,
      now,
    });

    return sendSelfCheckNotification;
  };

  it('suppresses the silent-session reminder for a session whose only owner call uses the candidate tag family', async () => {
    const sendSelfCheckNotification = await runUseCaseWithTranscript([
      assistantEntryWith(
        '<call-to-user-pending>Please decide.</call-to-user-pending>',
      ),
    ]);

    expect(sendSelfCheckNotification).not.toHaveBeenCalled();
  });

  it('suppresses the silent-session reminder for a session whose only owner call uses the legacy literal tag family', async () => {
    const sendSelfCheckNotification = await runUseCaseWithTranscript([
      assistantEntryWith('<call-to-user>Please decide.</call-to-user>'),
    ]);

    expect(sendSelfCheckNotification).not.toHaveBeenCalled();
  });

  it('still sends the silent-session reminder for a silent session that raised no owner call', async () => {
    const sendSelfCheckNotification = await runUseCaseWithTranscript([
      assistantEntryWith('progress update'),
    ]);

    expect(sendSelfCheckNotification).toHaveBeenCalledWith(
      monitoredSessionName,
      'MAIN_STALLED',
    );
  });
});
