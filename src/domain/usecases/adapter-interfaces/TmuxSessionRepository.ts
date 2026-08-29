import { LiveTmuxSession } from '../../entities/LiveTmuxSession';

export interface TmuxSessionRepository {
  listLiveSessionNames: () => Promise<string[]>;
  listLiveSessionsWithActivity: () => Promise<LiveTmuxSession[]>;
  listInteractiveProcessCommandLines: () => Promise<string[]>;
  launchDetachedSession: (
    sessionName: string,
    launcherCommand: string,
    issueUrl: string,
  ) => Promise<void>;
  killSession: (sessionName: string) => Promise<void>;
  killOwnSession: () => Promise<void>;
  sendKeys: (sessionName: string, literalText: string) => Promise<void>;
  launchBareNameLeaderSession: (name: string) => Promise<void>;
  attachOrCreateInteractiveSession: (
    issueUrl: string,
    scopeLibPath: string | null,
  ) => Promise<void>;
}
