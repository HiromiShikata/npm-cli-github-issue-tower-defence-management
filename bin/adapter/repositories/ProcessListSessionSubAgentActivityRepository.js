"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessListSessionSubAgentActivityRepository = void 0;
class ProcessListSessionSubAgentActivityRepository {
    constructor(matchPattern, processLister, silentSecondsResolver) {
        this.processLister = processLister;
        this.silentSecondsResolver = silentSecondsResolver;
        this.listSubAgentActivitiesBySessionName = async (sessionNames) => {
            const result = new Map();
            if (this.matchRegExp === null) {
                return result;
            }
            const monitoredSessionNames = new Set(sessionNames);
            const processes = await this.processLister.listProcesses();
            for (const process of processes) {
                const match = this.matchRegExp.exec(process.commandLine);
                if (match === null || match.groups === undefined) {
                    continue;
                }
                const sessionName = match.groups.session;
                if (sessionName === undefined ||
                    !monitoredSessionNames.has(sessionName)) {
                    continue;
                }
                const label = match.groups.label ?? sessionName;
                const activity = {
                    label,
                    silentSeconds: this.silentSecondsResolver.resolveSilentSeconds(label),
                    runningSeconds: process.elapsedSeconds,
                    waitingOnExternalProcess: false,
                };
                const existing = result.get(sessionName);
                if (existing === undefined) {
                    result.set(sessionName, [activity]);
                }
                else {
                    existing.push(activity);
                }
            }
            return result;
        };
        this.matchRegExp =
            matchPattern === null || matchPattern.length === 0
                ? null
                : new RegExp(matchPattern);
    }
}
exports.ProcessListSessionSubAgentActivityRepository = ProcessListSessionSubAgentActivityRepository;
//# sourceMappingURL=ProcessListSessionSubAgentActivityRepository.js.map