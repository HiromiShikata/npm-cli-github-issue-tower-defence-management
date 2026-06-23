export interface TmuxSessionRepository {
    listLiveSessionNames: () => Promise<string[]>;
    listInteractiveProcessCommandLines: () => Promise<string[]>;
    launchDetachedSession: (sessionName: string, launcherCommand: string, issueUrl: string) => Promise<void>;
}
//# sourceMappingURL=TmuxSessionRepository.d.ts.map