"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InTmuxByHumanSessionTokenCountUseCase = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
class InTmuxByHumanSessionTokenCountUseCase {
    constructor() {
        this.run = (candidates, interactiveSessions, issues) => {
            const inTmuxByHumanIssueUrls = this.inTmuxByHumanIssueUrls(issues);
            const distinctSessionIdsByToken = this.distinctSessionIdsByToken(interactiveSessions, inTmuxByHumanIssueUrls);
            const counts = candidates.map((candidate) => ({
                name: candidate.name,
                token: candidate.token,
                count: distinctSessionIdsByToken.get(candidate.token)?.size ?? 0,
            }));
            return { counts };
        };
        this.inTmuxByHumanIssueUrls = (issues) => {
            const urls = new Set();
            for (const issue of issues) {
                if (issue.status === WorkflowStatus_1.IN_TMUX_STATUS_NAME && issue.isClosed === false) {
                    urls.add(issue.url);
                }
            }
            return urls;
        };
        this.distinctSessionIdsByToken = (interactiveSessions, inTmuxByHumanIssueUrls) => {
            const sessionIdsByToken = new Map();
            for (const session of interactiveSessions) {
                if (!inTmuxByHumanIssueUrls.has(session.issueUrl)) {
                    continue;
                }
                const sessionIds = sessionIdsByToken.get(session.token) ?? new Set();
                sessionIds.add(session.sessionId);
                sessionIdsByToken.set(session.token, sessionIds);
            }
            return sessionIdsByToken;
        };
    }
}
exports.InTmuxByHumanSessionTokenCountUseCase = InTmuxByHumanSessionTokenCountUseCase;
//# sourceMappingURL=InTmuxByHumanSessionTokenCountUseCase.js.map