"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignNoAssigneeIssueToManagerUseCase = void 0;
class AssignNoAssigneeIssueToManagerUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const authorAllowList = input.autoAssignManagerAuthors &&
                input.autoAssignManagerAuthors.length > 0
                ? input.autoAssignManagerAuthors
                : null;
            const isAssignable = (target) => {
                if (target.assignees.length > 0 || target.state !== 'OPEN') {
                    return false;
                }
                return (authorAllowList === null || authorAllowList.includes(target.author));
            };
            for (const issue of input.issues) {
                if (!isAssignable(issue)) {
                    continue;
                }
                await this.assignManager(issue, issue.url, input.manager);
            }
            const project = input.projectToAddSearchedIssues;
            const query = input.queryToAddProject;
            if (!input.queryToAddProjectEnabled || !project || !query) {
                return;
            }
            const projectItemUrls = new Set(input.issues.map((issue) => issue.url));
            const searchedIssues = await this.searchIssues(query);
            for (const searchedIssue of searchedIssues) {
                if (projectItemUrls.has(searchedIssue.url) ||
                    !isAssignable(searchedIssue)) {
                    continue;
                }
                if (!(await this.addToProject(project, searchedIssue))) {
                    continue;
                }
                if (!(await this.assignManager({
                    org: searchedIssue.org,
                    repo: searchedIssue.repo,
                    number: searchedIssue.number,
                }, searchedIssue.url, input.manager))) {
                    continue;
                }
                await this.waitBeforeNextRequest();
            }
        };
        this.searchIssues = async (query) => {
            try {
                return await this.issueRepository.searchIssues(query);
            }
            catch (e) {
                if (!(e instanceof Error)) {
                    throw e;
                }
                console.error(`Failed to search issues by ${query}: ${e.message}`);
                return [];
            }
        };
        this.addToProject = async (project, searchedIssue) => {
            try {
                await this.issueRepository.addIssueToProject(project, searchedIssue.url);
            }
            catch (e) {
                if (!(e instanceof Error)) {
                    throw e;
                }
                console.error(`Failed to add issue ${searchedIssue.url} to project: ${e.message}`);
                return false;
            }
            return true;
        };
        this.assignManager = async (issue, issueUrl, manager) => {
            try {
                await this.issueRepository.updateAssigneeList(issue, [manager]);
            }
            catch (e) {
                if (!(e instanceof Error)) {
                    throw e;
                }
                console.error(`Failed to update assignee for issue ${issueUrl}: ${e.message}`);
                return false;
            }
            return true;
        };
        this.waitBeforeNextRequest = async () => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        };
    }
}
exports.AssignNoAssigneeIssueToManagerUseCase = AssignNoAssigneeIssueToManagerUseCase;
//# sourceMappingURL=AssignNoAssigneeIssueToManagerUseCase.js.map