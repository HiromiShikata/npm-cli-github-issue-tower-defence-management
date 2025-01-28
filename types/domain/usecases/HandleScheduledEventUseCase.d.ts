import { Issue, Label } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project, StoryOption } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { GenerateWorkingTimeReportUseCase } from './GenerateWorkingTimeReportUseCase';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { SpreadsheetRepository } from './adapter-interfaces/SpreadsheetRepository';
import { ActionAnnouncementUseCase } from './ActionAnnouncementUseCase';
import { SetWorkflowManagementIssueToStoryUseCase } from './SetWorkflowManagementIssueToStoryUseCase';
import { ClearNextActionHourUseCase } from './ClearNextActionHourUseCase';
import { AnalyzeProblemByIssueUseCase } from './AnalyzeProblemByIssueUseCase';
import { AnalyzeStoriesUseCase } from './AnalyzeStoriesUseCase';
import { ClearDependedIssueURLUseCase } from './ClearDependedIssueURLUseCase';
import { CreateEstimationIssueUseCase } from './CreateEstimationIssueUseCase';
import { ConvertCheckboxToIssueInStoryIssueUseCase } from './ConvertCheckboxToIssueInStoryIssueUseCase';
import { ChangeStatusLongInReviewIssueUseCase } from './ChangeStatusLongInReviewIssueUseCase';
export declare class ProjectNotFoundError extends Error {
    constructor(message: string);
}
export type StoryObject = {
    story: StoryOption;
    storyIssue: Issue | null;
    issues: (Issue & {
        totalWorkingTime: number;
        totalWorkingTimeByAssignee: Map<string, number>;
    })[];
};
export type StoryObjectMap = Map<string, StoryObject>;
export declare class HandleScheduledEventUseCase {
    readonly generateWorkingTimeReportUseCase: GenerateWorkingTimeReportUseCase;
    readonly actionAnnouncementUseCase: ActionAnnouncementUseCase;
    readonly setWorkflowManagementIssueToStoryUseCase: SetWorkflowManagementIssueToStoryUseCase;
    readonly clearNextActionHourUseCase: ClearNextActionHourUseCase;
    readonly analyzeProblemByIssueUseCase: AnalyzeProblemByIssueUseCase;
    readonly analyzeStoriesUseCase: AnalyzeStoriesUseCase;
    readonly clearDependedIssueURLUseCase: ClearDependedIssueURLUseCase;
    readonly createEstimationIssueUseCase: CreateEstimationIssueUseCase;
    readonly convertCheckboxToIssueInStoryIssueUseCase: ConvertCheckboxToIssueInStoryIssueUseCase;
    readonly changeStatusLongInReviewIssueUseCase: ChangeStatusLongInReviewIssueUseCase;
    readonly dateRepository: DateRepository;
    readonly spreadsheetRepository: SpreadsheetRepository;
    readonly projectRepository: ProjectRepository;
    readonly issueRepository: IssueRepository;
    constructor(generateWorkingTimeReportUseCase: GenerateWorkingTimeReportUseCase, actionAnnouncementUseCase: ActionAnnouncementUseCase, setWorkflowManagementIssueToStoryUseCase: SetWorkflowManagementIssueToStoryUseCase, clearNextActionHourUseCase: ClearNextActionHourUseCase, analyzeProblemByIssueUseCase: AnalyzeProblemByIssueUseCase, analyzeStoriesUseCase: AnalyzeStoriesUseCase, clearDependedIssueURLUseCase: ClearDependedIssueURLUseCase, createEstimationIssueUseCase: CreateEstimationIssueUseCase, convertCheckboxToIssueInStoryIssueUseCase: ConvertCheckboxToIssueInStoryIssueUseCase, changeStatusLongInReviewIssueUseCase: ChangeStatusLongInReviewIssueUseCase, dateRepository: DateRepository, spreadsheetRepository: SpreadsheetRepository, projectRepository: ProjectRepository, issueRepository: IssueRepository);
    run: (input: {
        projectName: string;
        org: string;
        projectUrl: string;
        manager: Member["name"];
        workingReport: {
            repo: string;
            members: Member["name"][];
            warningThresholdHour?: number;
            spreadsheetUrl: string;
            reportIssueTemplate?: string;
            reportIssueLabels: Label[];
        };
        urlOfStoryView: string;
        disabledStatus: string;
    }) => Promise<{
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        targetDateTimes: Date[];
        storyIssues: StoryObjectMap;
    }>;
    runEachUseCases: (input: Parameters<HandleScheduledEventUseCase["run"]>[0], project: Project, issues: Issue[], cacheUsed: boolean, targetDateTimes: Date[], storyObjectMap: StoryObjectMap) => Promise<void>;
    runForGenerateWorkingTimeReportUseCase: (input: {
        org: string;
        manager: Member["name"];
        workingReport: {
            repo: string;
            members: Member["name"][];
            warningThresholdHour?: number;
            spreadsheetUrl: string;
            reportIssueTemplate?: string;
            reportIssueLabels: Label[];
        };
        projectId: Project["id"];
        issues: Issue[];
        targetDateTime: Date;
    }) => Promise<void>;
    static createTargetDateTimes: (from: Date, to: Date) => Date[];
    findTargetDateAndUpdateLastExecutionDateTime: (spreadsheetUrl: string, now: Date) => Promise<Date[]>;
    storyIssues: (input: {
        project: Project;
        issues: Issue[];
    }) => Promise<StoryObjectMap>;
    calculateTotalWorkingMinutesByAssignee: (issue: Issue) => Map<string, number>;
}
//# sourceMappingURL=HandleScheduledEventUseCase.d.ts.map