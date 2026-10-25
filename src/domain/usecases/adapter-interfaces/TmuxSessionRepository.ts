import { LiveTmuxSession } from '../../entities/LiveTmuxSession';

export interface TmuxSessionRepository {
  listSessionNamesForIssueUrl: (issueUrl: string) => Promise<string[]>;
  listSessionNamesForIssueUrls?: (
    issueUrls: string[],
  ) => Promise<Map<string, string[]>>;
  listLiveSessionNames: () => Promise<string[]>;
  listLiveSessionsWithActivity: () => Promise<LiveTmuxSession[]>;
  listInteractiveProcessCommandLines: () => Promise<string[]>;
  listRunningWorkerScopeUnitNames: () => Promise<string[]>;
  stopWorkerScopeUnit: (scopeUnitName: string) => Promise<void>;
  launchDetachedSession: (
    sessionName: string,
    launcherCommand: string,
    issueUrl: string,
  ) => Promise<void>;
  killSession: (sessionName: string) => Promise<void>;
  killOwnSession: () => Promise<void>;
  sendKeys: (sessionName: string, literalText: string) => Promise<void>;
  attachOrCreateInteractiveSession: (
    issueUrl: string,
    scopeLibPath: string | null,
  ) => Promise<void>;
}
