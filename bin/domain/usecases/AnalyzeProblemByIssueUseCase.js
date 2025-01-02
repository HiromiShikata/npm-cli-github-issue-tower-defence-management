"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyzeProblemByIssueUseCase = void 0;
const utils_1 = require("./utils");
class AnalyzeProblemByIssueUseCase {
    constructor(issueRepository, dateRepository) {
        this.issueRepository = issueRepository;
        this.dateRepository = dateRepository;
        this.run = async (input) => {
            const story = input.project.story;
            if (!story ||
                !input.targetDates.find((targetDate) => targetDate.getHours() === 0 && targetDate.getMinutes() === 0)) {
                return;
            }
            const targetDate = input.targetDates[input.targetDates.length - 1];
            if (!targetDate) {
                return;
            }
            await this.checkInProgress({ ...input, targetDate });
            for (const storyObject of input.storyObjectMap.values()) {
                const storyIssue = storyObject.storyIssue;
                if (!storyIssue) {
                    continue;
                }
                await this.issueRepository.createComment(storyIssue, this.createSummaryCommentBody({ ...storyObject, storyIssue }));
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        };
        this.checkInProgress = async (input) => {
            const assigneeToNotify = [];
            for (const member of input.members) {
                let topIssue = null;
                for (const story of input.storyObjectMap.values()) {
                    const storyIssueObject = input.storyObjectMap.get(story.story.name);
                    if (!storyIssueObject) {
                        continue;
                    }
                    else if (assigneeToNotify.includes(member)) {
                        break;
                    }
                    for (const issue of storyIssueObject.issues) {
                        if (!(0, utils_1.isVisibleIssue)(issue, member, input.targetDate, input.disabledStatus) ||
                            issue.status?.toLowerCase().includes('review') ||
                            issue.title.toLowerCase().includes('review') ||
                            issue.isPr) {
                            continue;
                        }
                        if (topIssue === null) {
                            topIssue = issue;
                            break;
                        }
                        if (!issue.isInProgress) {
                            continue;
                        }
                        assigneeToNotify.push(member);
                        break;
                    }
                }
            }
            if (assigneeToNotify.length === 0) {
                return;
            }
            await this.issueRepository.createNewIssue(input.org, input.repo, 'Check in progress', `${assigneeToNotify.join('\n')}`, [input.manager], ['story:workflow-management']);
        };
        this.createSummaryCommentBody = (storyObject) => {
            const getFlowchartIdFromUrl = (url) => {
                return url.split('/').slice(-3).join('/');
            };
            const issueTitleForFlowchart = (title) => {
                return title.replace('"', "'");
            };
            const flowChart = `
\`\`\`mermaid

flowchart TD
${storyObject.issues
                .map((issue) => `    ${getFlowchartIdFromUrl(issue.url)}["${issue.isClosed ? '🟣' : '🟢'}#${issue.number} ${issue.isClosed ? 'Closed' : 'Open'}<br/>${issue.assignees.map((a) => `${a}`).join('<br/>')}<br/>${issueTitleForFlowchart(issue.title)}"]`)
                .join('\n')}
${storyObject.issues
                .map((issue) => Array.from(issue.dependedIssueUrls)
                .map((dependedIssueUrl) => {
                if (issue.isClosed) {
                    issue.totalWorkingTimeByAssignee;
                    return `    ${getFlowchartIdFromUrl(dependedIssueUrl)} -->|total: ${this.dateRepository.formatDurationToHHMM(issue.totalWorkingTime)}<br/>${Array.from(issue.totalWorkingTimeByAssignee)
                        .map(([author, workingMinutes]) => `@${author} ${this.dateRepository.formatDurationToHHMM(workingMinutes)}`)
                        .join('<br/>')}| ${getFlowchartIdFromUrl(issue.url)}`;
                }
                return `    ${getFlowchartIdFromUrl(dependedIssueUrl)} -->|${issue.estimationMinutes
                    ? `Estimation: ${this.dateRepository.formatDurationToHHMM(issue.estimationMinutes)}<br/>`
                    : ''}<br/>by ${issue.completionDate50PercentConfidence
                    ? this.dateRepository.formatDateWithDayOfWeek(issue.completionDate50PercentConfidence)
                    : 'Unknown'}| ${getFlowchartIdFromUrl(issue.url)}`;
            })
                .join('\n'))
                .join('\n')}
    %% click event 
    ${storyObject.issues
                .map((issue) => `click ${getFlowchartIdFromUrl(issue.url)} "${issue.url}"`)
                .join('\n')}
    
\`\`\``;
            let noMultipleNewLineBody = `
Total: ${this.dateRepository.formatDurationToHHMM(Array.from(storyObject.issues.values()).reduce((a, b) => a + b.totalWorkingTime, 0))}

${storyObject.issues
                .map((issue) => `- ${this.dateRepository.formatDurationToHHMM(issue.totalWorkingTime)} ${issue.url}
  - Total
${Array.from(issue.totalWorkingTimeByAssignee)
                .map(([author, workingMinutes]) => `    - ${this.dateRepository.formatDurationToHHMM(workingMinutes)}, ${author}`)
                .join('\n')}
  - Timeline
${issue.workingTimeline
                .map(({ startedAt, endedAt, durationMinutes, author }) => `    - ${this.dateRepository.formatDurationToHHMM(durationMinutes)}, ${this.dateRepository.formatStartEnd(startedAt, endedAt)}}, ${author}`)
                .join('\n')}`)
                .join('\n')}`;
            while (noMultipleNewLineBody.includes('\n\n')) {
                noMultipleNewLineBody = noMultipleNewLineBody.replace('\n\n', '\n');
            }
            return `${flowChart}

${noMultipleNewLineBody}
`;
        };
        this.createQuestionIssueBody = (issue, totalWorkingTime, totalWorkingTimeByAssignee) => {
            return `Hi,
I worry about the situation of #${issue.number} (${issue.title}) because the total working time is over 120 minutes.
Could you please share the situation? :pray:

## Total
${this.dateRepository.formatDurationToHHMM(totalWorkingTime)}

## From the record
Working Minutes, Author, 
${Array.from(totalWorkingTimeByAssignee)
                .map(([author, workingMinutes]) => `${this.dateRepository.formatDurationToHHMM(workingMinutes)}, ${author}`)
                .join('\n')}


## Timeline
Start, End, Duration, Author
${issue.workingTimeline
                .map(({ startedAt, endedAt, durationMinutes, author }) => `${this.dateRepository.formatDurationToHHMM(startedAt.getMinutes())}, ${this.dateRepository.formatDurationToHHMM(endedAt.getMinutes())}, ${this.dateRepository.formatDurationToHHMM(durationMinutes)}, ${author}`)
                .join('\n')}
`;
        };
    }
}
exports.AnalyzeProblemByIssueUseCase = AnalyzeProblemByIssueUseCase;
//# sourceMappingURL=AnalyzeProblemByIssueUseCase.js.map