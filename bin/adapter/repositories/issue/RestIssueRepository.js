"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestIssueRepository = void 0;
const ky_1 = __importDefault(require("ky"));
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
            await ky_1.default.delete(`https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}/labels/${encodeURIComponent(label)}`, {
                headers: {
                    Authorization: `token ${this.ghToken}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            });
            return;
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