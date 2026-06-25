"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InTmuxByHumanSessionReconcileUseCase = exports.toTmuxSessionName = void 0;
const WorkflowStatus_1 = require("../../entities/WorkflowStatus");
// tmux sanitizes a requested session name by replacing only `.` and `:` with
// `_`, while keeping every other character (including `/`). The Termux app
// launches each agent with `tmux new -A -s {ISSUE_URL}`, so tmux derives the
// authoritative session name from the raw issue URL. This function MUST return
// exactly that derived name so the reconciler recognizes the app's existing
// session instead of creating a duplicate under a differently-normalized name.
// For example `https://github.com/owner/repo/issues/9` becomes
// `https_//github_com/owner/repo/issues/9`.
const toTmuxSessionName = (issueUrl) => issueUrl.replace(/[.:]/g, '_');
exports.toTmuxSessionName = toTmuxSessionName;
class InTmuxByHumanSessionReconcileUseCase {
    constructor(tmuxSessionRepository) {
        this.tmuxSessionRepository = tmuxSessionRepository;
        this.run = async (input) => {
            const { issues, assigneeLogin, launcherCommand, now } = input;
            const targetIssues = issues.filter((issue) => this.isInTmuxByHuman(issue, assigneeLogin, now));
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
        this.isInTmuxByHuman = (issue, assigneeLogin, now) => issue.status === WorkflowStatus_1.IN_TMUX_STATUS_NAME &&
            issue.isClosed === false &&
            issue.assignees.includes(assigneeLogin) &&
            (issue.nextActionDate === null ||
                issue.nextActionDate.getTime() <= now.getTime()) &&
            issue.nextActionHour === null;
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