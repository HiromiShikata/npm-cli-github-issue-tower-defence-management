"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiV3IssueRepository = void 0;
const axios_1 = __importDefault(require("axios"));
const BaseGitHubRepository_1 = require("../BaseGitHubRepository");
class ApiV3IssueRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor() {
        super(...arguments);
        this.searchIssue = async (query) => {
            // example: curl -H "Authorization: token $GH_TOKEN"      -H "Accept: application/vnd.github.v3+json"      "https://api.github.com/search/issues?q=repo:$OWNER/$REPO+type:issue+state:open+in:title+'Maintain%20Kanban'&created=2024-05-08&assignee=HiromiShkata"
            let url = `https://api.github.com/search/issues?q=repo:${query.owner}/${query.repositoryName}`;
            if (query.type) {
                url += `+type:${query.type}`;
            }
            if (query.state) {
                url += `+state:${query.state}`;
            }
            if (query.title) {
                url += `+in:title+'${query.title}'`;
            }
            if (query.createdFrom) {
                url += `+created:>=${query.createdFrom}`;
            }
            if (query.assignee) {
                url += `&assignee=${query.assignee}`;
            }
            const response = await axios_1.default.get(url, {
                headers: {
                    Authorization: `token ${this.ghToken}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            });
            if (response.status !== 200) {
                throw new Error(`Failed to search issue: ${response.status}`);
            }
            return response.data.items.map((item) => ({
                url: item.html_url,
                title: item.title,
                number: item.number,
            }));
        };
    }
}
exports.ApiV3IssueRepository = ApiV3IssueRepository;
//# sourceMappingURL=ApiV3IssueRepository.js.map