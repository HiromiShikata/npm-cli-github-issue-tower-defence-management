"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InTmuxByHumanSessionReconcileUseCase = exports.toTmuxSessionName = void 0;
const WorkflowStatus_1 = require("../../entities/WorkflowStatus");
const toTmuxSessionName = (issueUrl) => issueUrl.replace(/[^a-zA-Z0-9]/g, '_');
exports.toTmuxSessionName = toTmuxSessionName;
class InTmuxByHumanSessionReconcileUseCase {
    constructor(tmuxSessionRepository) {
        this.tmuxSessionRepository = tmuxSessionRepository;
        this.run = async (input) => {
            const { issues, assigneeLogin, launcherCommand } = input;
            const targetIssues = issues.filter((issue) => this.isInTmuxByHuman(issue, assigneeLogin));
            if (targetIssues.length === 0) {
                return { launchedIssueUrls: [] };
            }
            const liveSessionNames = new Set(await this.tmuxSessionRepository.listLiveSessionNames());
            const processCommandLines = await this.tmuxSessionRepository.listInteractiveProcessCommandLines();
            const launchedIssueUrls = [];
            for (const issue of targetIssues) {
                if (this.hasLiveSession(issue.url, liveSessionNames, processCommandLines)) {
                    continue;
                }
                await this.tmuxSessionRepository.launchDetachedSession((0, exports.toTmuxSessionName)(issue.url), launcherCommand, issue.url);
                launchedIssueUrls.push(issue.url);
            }
            return { launchedIssueUrls };
        };
        this.isInTmuxByHuman = (issue, assigneeLogin) => issue.status === WorkflowStatus_1.IN_TMUX_STATUS_NAME &&
            issue.isClosed === false &&
            issue.assignees.includes(assigneeLogin);
        this.hasLiveSession = (issueUrl, liveSessionNames, processCommandLines) => {
            const sessionName = (0, exports.toTmuxSessionName)(issueUrl);
            if (!liveSessionNames.has(sessionName)) {
                return false;
            }
            return processCommandLines.some((commandLine) => commandLine.includes(issueUrl));
        };
    }
}
exports.InTmuxByHumanSessionReconcileUseCase = InTmuxByHumanSessionReconcileUseCase;
//# sourceMappingURL=InTmuxByHumanSessionReconcileUseCase.js.map