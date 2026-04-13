"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestIssueRepository = void 0;
const ky_1 = __importStar(require("ky"));
const BaseGitHubRepository_1 = require("../BaseGitHubRepository");
class RestIssueRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor() {
        super(...arguments);
        this.createComment = async (issueUrl, comment) => {
            const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
            await ky_1.default.post(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
                json: { body: comment },
                headers: { Authorization: `token ${this.ghToken}` },
            });
        };
        this.createNewIssue = async (owner, repo, title, body, assignees, labels) => {
            const response = await ky_1.default
                .post(`https://api.github.com/repos/${owner}/${repo}/issues`, {
                json: { title, body, assignees, labels },
                headers: { Authorization: `token ${this.ghToken}` },
            })
                .json();
            return response.number;
        };
        this.getIssue = async (issueUrl) => {
            const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
            const response = await ky_1.default
                .get(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
                headers: {
                    Authorization: `token ${this.ghToken}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            })
                .json();
            return {
                labels: response.labels.map((label) => label.name),
                assignees: response.assignees.map((assignee) => assignee.login),
                title: response.title,
                body: response.body,
                number: response.number,
                state: response.state,
                created_at: response.created_at,
            };
        };
        this.updateIssue = async (issue) => {
            await ky_1.default.patch(`https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}`, {
                json: {
                    title: issue.title,
                    body: issue.body,
                    assignees: issue.assignees,
                    labels: issue.labels,
                    state: issue.state,
                },
                headers: { Authorization: `token ${this.ghToken}` },
            });
        };
        this.updateLabels = async (issue, labels) => {
            await ky_1.default.put(`https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}/labels`, {
                json: { labels },
                headers: {
                    Authorization: `token ${this.ghToken}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            });
            return;
        };
        this.removeLabel = async (issue, label) => {
            try {
                await ky_1.default.delete(`https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}/labels/${encodeURIComponent(label)}`, {
                    headers: {
                        Authorization: `token ${this.ghToken}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                });
            }
            catch (e) {
                if (e instanceof ky_1.HTTPError && e.response.status === 404) {
                    return;
                }
                throw e;
            }
        };
        this.updateAssigneeList = async (issue, assigneeList) => {
            await ky_1.default.patch(`https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}`, {
                json: { assignees: assigneeList },
                headers: { Authorization: `token ${this.ghToken}` },
            });
        };
    }
}
exports.RestIssueRepository = RestIssueRepository;
//# sourceMappingURL=RestIssueRepository.js.map