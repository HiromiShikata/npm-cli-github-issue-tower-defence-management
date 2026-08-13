import { resolveUnansweredOwnerCallsByTmuxSessionName } from './resolveUnansweredOwnerCalls';
import { UnansweredOwnerCall } from '../../../domain/entities/UnansweredOwnerCall';
import { InteractiveLiveSession } from '../../../domain/entities/InteractiveLiveSession';
import { LiveSessionProcessSnapshot } from '../../../domain/entities/LiveSessionProcessSnapshot';
import { toTmuxSessionName } from '../../../domain/usecases/intmux/InTmuxByHumanSessionReconcileUseCase';

const ISSUE_URL = 'https://github.com/demo/repo/issues/1';
const TMUX_SESSION_NAME = toTmuxSessionName(ISSUE_URL);
const CONFIG_DIR = '/home/agent/.claude';
const SESSION_ID = 'session-id-1';

const snapshotWithSession = (): LiveSessionProcessSnapshot => ({
  sessions: [{ sessionName: TMUX_SESSION_NAME, panePids: [100] }],
  processes: [
    {
      pid: 100,
      ppid: 1,
      commandLine: `claude ${ISSUE_URL}`,
      sessionId: SESSION_ID,
      currentSessionId: SESSION_ID,
      configDir: CONFIG_DIR,
    },
  ],
});

describe('resolveUnansweredOwnerCallsByTmuxSessionName', () => {
  it('asks the call provider for the transcripts of the live interactive sessions and returns what it reports', async () => {
    const call: UnansweredOwnerCall = {
      calledAt: '2026-08-13T10:14:00.000Z',
      body: 'Please decide whether to merge the release branch',
    };
    const requestedTranscriptPaths: Map<string, string>[] = [];
    const resolvedSessions: InteractiveLiveSession[][] = [];

    const result = await resolveUnansweredOwnerCallsByTmuxSessionName({
      liveSessionProcessSnapshotProvider: {
        getSnapshot: async () => snapshotWithSession(),
      },
      interactiveLiveSessionTranscriptResolver: {
        resolveTranscriptPaths: (sessions) => {
          resolvedSessions.push(sessions);
          return new Map(
            sessions.map((session) => [
              session.sessionName,
              `/transcripts/${session.sessionId}.jsonl`,
            ]),
          );
        },
      },
      unansweredOwnerCallListProvider: {
        listUnansweredOwnerCallsBySessionName: async (
          transcriptPathBySessionName,
        ) => {
          requestedTranscriptPaths.push(transcriptPathBySessionName);
          return new Map([[TMUX_SESSION_NAME, [call]]]);
        },
      },
    });

    expect(resolvedSessions[0]?.map((session) => session.sessionName)).toEqual([
      TMUX_SESSION_NAME,
    ]);
    expect(requestedTranscriptPaths[0]?.get(TMUX_SESSION_NAME)).toBe(
      `/transcripts/${SESSION_ID}.jsonl`,
    );
    expect(result.get(TMUX_SESSION_NAME)).toEqual([call]);
  });

  it('keys the returned calls by the tmux session name the reconciler derives from the issue url', async () => {
    const result = await resolveUnansweredOwnerCallsByTmuxSessionName({
      liveSessionProcessSnapshotProvider: {
        getSnapshot: async () => snapshotWithSession(),
      },
      interactiveLiveSessionTranscriptResolver: {
        resolveTranscriptPaths: (sessions) =>
          new Map(
            sessions.map((session) => [session.sessionName, '/transcript']),
          ),
      },
      unansweredOwnerCallListProvider: {
        listUnansweredOwnerCallsBySessionName: async (
          transcriptPathBySessionName,
        ) =>
          new Map(
            [...transcriptPathBySessionName.keys()].map((sessionName) => [
              sessionName,
              [{ calledAt: '2026-08-13T10:14:00.000Z', body: 'body' }],
            ]),
          ),
      },
    });

    expect([...result.keys()]).toEqual([toTmuxSessionName(ISSUE_URL)]);
  });

  it('returns nothing when no live session exposes a transcript', async () => {
    const result = await resolveUnansweredOwnerCallsByTmuxSessionName({
      liveSessionProcessSnapshotProvider: {
        getSnapshot: async () => ({ sessions: [], processes: [] }),
      },
      interactiveLiveSessionTranscriptResolver: {
        resolveTranscriptPaths: () => new Map(),
      },
      unansweredOwnerCallListProvider: {
        listUnansweredOwnerCallsBySessionName: async () => new Map(),
      },
    });

    expect(result.size).toBe(0);
  });
});
