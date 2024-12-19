"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyzeProblemByIssueUseCase = void 0;
class AnalyzeProblemByIssueUseCase {
    constructor(issueRepository, dateRepository) {
        this.issueRepository = issueRepository;
        this.dateRepository = dateRepository;
        this.run = async (input) => {
            const story = input.project.story;
            if (!story ||
                !input.targetDates.find((targetDate) => targetDate.getHours() === 7 && targetDate.getMinutes() === 0)) {
                return;
            }
            const isTargetIssue = (issue) => {
                return (!issue.isPr &&
                    (issue.nextActionDate === null ||
                        issue.nextActionDate.getTime() <= input.targetDates[0].getTime()) &&
                    issue.nextActionHour === null);
            };
            const summaryStoryIssue = new Map();
            const targetStory = input.project.story?.stories.slice(0, 12) || [];
            for (const story of targetStory) {
                summaryStoryIssue.set(story.name, new Map());
                for (const issue of input.issues) {
                    if (issue.story !== story.name || !isTargetIssue(issue)) {
                        continue;
                    }
                    const totalWorkingTimeByAssignee = this.calculateTotalWorkingMinutesByAssignee(issue);
                    const totalWorkingTime = Math.round(Array.from(totalWorkingTimeByAssignee.values()).reduce((a, b) => a + b, 0));
                    const issueSummary = {
                        totalWorkingTime,
                        totalWorkingTimeByAssignee,
                    };
                    summaryStoryIssue.get(story.name)?.set(issue, issueSummary);
                    // if (totalWorkingTime < 240 || totalWorkingTime > 1440) {
                    //   continue;
                    // }
                    // await this.issueRepository.createNewIssue(
                    //   issue.org,
                    //   issue.repo,
                    //   `Please share the situation about #${issue.number} (${issue.title}) / total working time: ${totalWorkingTime} minutes`,
                    //   this.createQuestionIssueBody(
                    //     issue,
                    //     totalWorkingTime,
                    //     totalWorkingTimeByAssignee,
                    //   ),
                    //
                    //   [input.manager],
                    //   ['story:workflow-management'],
                    // );
                }
            }
            await this.issueRepository.createNewIssue(input.org, input.repo, `Summary of story issues`, this.createSummaryIssueBody(summaryStoryIssue), [input.manager], ['story:workflow-management']);
        };
        this.createSummaryIssueBody = (summaryStoryIssue) => {
            let noMultipleNewLineBody = `${Array.from(summaryStoryIssue)
                .map(([story, issues]) => `## ${this.dateRepository.formatDurationToHHMM(Array.from(issues.values()).reduce((a, b) => a + b.totalWorkingTime, 0))} ${story}
${Array.from(issues)
                .map(([issue, { totalWorkingTime, totalWorkingTimeByAssignee }]) => `- ${this.dateRepository.formatDurationToHHMM(totalWorkingTime)} ${totalWorkingTime > 300 ? ':warning: over 300min' : ''} ${issue.url} ${issue.assignees.map((a) => `@${a}`).join(' ')} ${issue.labels
                .map((label) => `https://github.com/${issue.nameWithOwner}/labels/${encodeURI(label).replace(/:/g, '%3A')}`)
                .join(' ')}
${issue.workingTimeline.length > 0 ? `  - Total` : ''}
${Array.from(totalWorkingTimeByAssignee)
                .map(([author, workingMinutes]) => `    - ${this.dateRepository.formatDurationToHHMM(workingMinutes)}, @${author}`)
                .join('\n')}
${issue.workingTimeline.length > 0 ? `  - Timeline` : ''}
${issue.workingTimeline
                .map(({ startedAt, endedAt, durationMinutes, author }) => `    - ${this.dateRepository.formatDurationToHHMM(startedAt.getMinutes())}, ${this.dateRepository.formatDurationToHHMM(endedAt.getMinutes())}, ${this.dateRepository.formatDurationToHHMM(durationMinutes)}, @${author}`)
                .join('\n')}`)
                .join('\n')}`)
                .join('\n')}`;
            while (noMultipleNewLineBody.includes('\n\n')) {
                noMultipleNewLineBody = noMultipleNewLineBody.replace('\n\n', '\n');
            }
            return noMultipleNewLineBody;
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
        this.calculateTotalWorkingMinutesByAssignee = (issue) => {
            const workingTimeLine = issue.workingTimeline;
            const mapWorkingTimeByAssignee = new Map();
            for (const workingTime of workingTimeLine) {
                const author = workingTime.author;
                const workingMinutes = workingTime.durationMinutes;
                if (!mapWorkingTimeByAssignee.has(author)) {
                    mapWorkingTimeByAssignee.set(author, 0);
                }
                const currentWorkingMinutes = mapWorkingTimeByAssignee.get(author) || 0;
                mapWorkingTimeByAssignee.set(author, currentWorkingMinutes + workingMinutes);
            }
            return mapWorkingTimeByAssignee;
        };
    }
}
exports.AnalyzeProblemByIssueUseCase = AnalyzeProblemByIssueUseCase;
//# sourceMappingURL=AnalyzeProblemByIssueUseCase.js.map