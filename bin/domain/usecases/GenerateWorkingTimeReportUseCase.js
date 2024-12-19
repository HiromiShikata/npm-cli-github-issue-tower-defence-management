"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateWorkingTimeReportUseCase = void 0;
class GenerateWorkingTimeReportUseCase {
    constructor(issueRepository, spreadsheetRepository, dateRepository) {
        this.issueRepository = issueRepository;
        this.spreadsheetRepository = spreadsheetRepository;
        this.dateRepository = dateRepository;
        this.run = async (input) => {
            const workingReportIssueTemplate = await this.getWorkingReportIssueTemplate(input);
            const reportRows = [];
            for (const member of input.members) {
                try {
                    const memberReportRows = await this.createIssueForEachAuthor(member, input.targetDate, input.issues, input.org, input.repo, input.reportIssueLabels, workingReportIssueTemplate, input.warningThresholdHour);
                    reportRows.push(...memberReportRows);
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
                catch (e) {
                    await this.issueRepository.createNewIssue(input.org, input.repo, `Error occured while creating working report for ${member}`, `${JSON.stringify(e)}`, [input.manager], ['bug']);
                }
            }
            await this.spreadsheetRepository.appendSheetValues(input.spreadsheetUrl, 'IssueLogEditable', reportRows);
            await this.spreadsheetRepository.appendSheetValues(input.spreadsheetUrl, 'IssueLogRawData', reportRows);
        };
        this.getWorkingReportIssueTemplate = async (input) => {
            if (input.reportIssueTemplate) {
                return input.reportIssueTemplate;
            }
            return `
Please confirm each working time and total working time and assign to  :bow:
Fix warnings if you have :warning: mark in Detail section.
If you have any questions, please put comment and assign to @${input.manager} :pray:

## Working report for {AUTHOR} on {DATE_WITH_DAY_OF_WEEK}
### Total
\`\`\`
{TOTAL_WORKING_TIME_HHMM}
\`\`\`

### Detail
{TIMELINE_DETAILS}

Summary of working report: ${input.spreadsheetUrl}
`;
        };
        this.createIssueForEachAuthor = async (author, date, issues, org, repo, labels, workingReportIssueTemplate, workingTimeThresholdHour = 6) => {
            const dateString = `${date.toISOString().split('T')[0]}`;
            const dateStringWithDoW = `${date.toISOString().split('T')[0]} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]})`;
            const timelineEvents = this.filterTimelineAndSortByAuthor(issues, date, author, workingTimeThresholdHour);
            const totalHhmm = this.calculateTotalHhmm(timelineEvents);
            const timelineDetails = this.applyToTimelineDetails(timelineEvents);
            const title = this.applyReplacementToTemplate({
                template: 'Working report for {AUTHOR} on {DATE_WITH_DAY_OF_WEEK}',
                replacement: {
                    AUTHOR: author,
                    DATE_WITH_DAY_OF_WEEK: dateStringWithDoW,
                },
            });
            const body = this.applyReplacementToTemplate({
                template: workingReportIssueTemplate,
                replacement: {
                    AUTHOR: author,
                    DATE_WITH_DAY_OF_WEEK: dateStringWithDoW,
                    TOTAL_WORKING_TIME_HHMM: totalHhmm,
                    TIMELINE_DETAILS: timelineDetails,
                },
            });
            await this.issueRepository.createNewIssue(org, repo, title, body, [author], labels);
            const issueLogRows = timelineEvents.map((event) => [
                dateString,
                event.startHhmm,
                event.endHhmm,
                author,
                event.warnings.join(':'),
                event.issueUrl,
                event.labels.join(':'),
            ]);
            return issueLogRows;
        };
        this.filterTimelineAndSortByAuthor = (issues, targetDate, author, workingTimeThresholdHour) => {
            const dateString = targetDate.toISOString().split('T')[0];
            const timelineEvents = [];
            for (const issue of issues) {
                const filteredTimeline = issue.workingTimeline.filter((event) => event.author === author);
                for (const event of filteredTimeline) {
                    const start = event.startedAt.toISOString();
                    const end = event.endedAt.toISOString();
                    if (end.split('T')[0] !== dateString) {
                        continue;
                    }
                    const startHhmm = this.convertIsoToHhmm(start);
                    const endHhmm = this.convertIsoToHhmm(end);
                    const durationHhmm = this.calculateDuration(start, end);
                    timelineEvents.push({
                        issueUrl: issue.url,
                        issueTitle: issue.title,
                        startHhmm,
                        endHhmm,
                        durationHhmm,
                        warnings: [],
                        labels: issue.labels,
                        nameWithOwner: issue.nameWithOwner,
                    });
                }
            }
            const sortedTimelineEvents = timelineEvents.sort((a, b) => {
                if (a.endHhmm === b.endHhmm) {
                    return a.startHhmm.localeCompare(b.startHhmm);
                }
                return a.endHhmm.localeCompare(b.endHhmm);
            });
            for (let i = 0; i < sortedTimelineEvents.length - 1; i++) {
                const current = sortedTimelineEvents[i];
                const currentDuration = sortedTimelineEvents[i].durationHhmm;
                const [hh] = currentDuration.split(':').map(Number);
                if (hh >= workingTimeThresholdHour) {
                    current.warnings.push(`Over ${workingTimeThresholdHour} hours`);
                }
                if (i === 0) {
                    continue;
                }
                const previous = sortedTimelineEvents[i - 1];
                if (previous.endHhmm > current.startHhmm) {
                    current.warnings.push(`Overlap`);
                }
            }
            return sortedTimelineEvents;
        };
        this.convertIsoToHhmm = (isoString) => {
            const date = new Date(isoString);
            const hh = date.getHours();
            const mm = date.getMinutes();
            return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        };
        this.calculateDuration = (startIsoString, endIsoString) => {
            const startDate = new Date(startIsoString);
            const endDate = new Date(endIsoString);
            startDate.setMilliseconds(0);
            startDate.setSeconds(0);
            endDate.setMilliseconds(0);
            endDate.setSeconds(0);
            const duration = endDate.getTime() - startDate.getTime();
            const hh = Math.floor(duration / (1000 * 60 * 60));
            const mm = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
            return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        };
        this.calculateTotalHhmm = (timelineEvents) => {
            const totalDuration = timelineEvents.reduce((acc, event) => {
                const [hh, mm] = event.durationHhmm.split(':').map(Number);
                return acc + hh * 60 + mm;
            }, 0);
            return this.dateRepository.formatDurationToHHMM(totalDuration);
        };
        this.applyToTimelineDetails = (timelineEvents) => {
            return `
- Start, End, Duration, Issue title, Labels
${timelineEvents.map((event) => this.applyToTimelineDetail(event)).join('\n')}
`;
        };
        this.applyToTimelineDetail = (timelineEvents) => {
            const labelUrls = timelineEvents.labels.map((label) => `https://github.com/${timelineEvents.nameWithOwner}/labels/${encodeURI(label).replace(/:/g, '%3A')}`);
            return `- ${timelineEvents.startHhmm}, ${timelineEvents.endHhmm}, ${timelineEvents.durationHhmm}, ${timelineEvents.warnings.length > 0 ? `:warning: ${timelineEvents.warnings.join(' ')}` : ''} ${timelineEvents.issueUrl}, ${labelUrls.join(' ')}`;
        };
        this.applyReplacementToTemplate = (input) => {
            const replacedText = Object.entries(input.replacement).reduce((acc, [key, value]) => {
                return acc.replace(new RegExp(`{${key}}`, 'g'), value);
            }, input.template);
            if (replacedText.includes('{')) {
                const unknownKeys = replacedText.match(/\{[^}]+}/g);
                if (!unknownKeys) {
                    throw new Error(`Broken template: ${replacedText}`);
                }
                throw new Error(`Failed to replace. Unknown keys: ${unknownKeys.map((key) => key.slice(1, -1)).join(', ')}`);
            }
            return replacedText;
        };
    }
}
exports.GenerateWorkingTimeReportUseCase = GenerateWorkingTimeReportUseCase;
//# sourceMappingURL=GenerateWorkingTimeReportUseCase.js.map