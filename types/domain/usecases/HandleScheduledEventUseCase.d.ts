import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project, StoryOption } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
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
import { ChangeStatusByStoryColorUseCase } from './ChangeStatusByStoryColorUseCase';
import { SetNoStoryIssueToStoryUseCase } from './SetNoStoryIssueToStoryUseCase';
import { CreateNewStoryByLabelUseCase } from './CreateNewStoryByLabelUseCase';
import { AssignNoAssigneeIssueToManagerUseCase } from './AssignNoAssigneeIssueToManagerUseCase';
import { UpdateIssueStatusByLabelUseCase } from './UpdateIssueStatusByLabelUseCase';
export declare class ProjectNotFoundError extends Error {
    constructor(message: string);
}
export type StoryObject = {
    story: StoryOption;
    storyIssue: Issue | null;
    issues: Issue[];
};
export type StoryObjectMap = Map<NonNullable<Project['story']>['stories'][0]['name'], StoryObject>;
export declare class HandleScheduledEventUseCase {
    readonly actionAnnouncementUseCase: ActionAnnouncementUseCase;
    readonly setWorkflowManagementIssueToStoryUseCase: SetWorkflowManagementIssueToStoryUseCase;
    readonly clearNextActionHourUseCase: ClearNextActionHourUseCase;
    readonly analyzeProblemByIssueUseCase: AnalyzeProblemByIssueUseCase;
    readonly analyzeStoriesUseCase: AnalyzeStoriesUseCase;
    readonly clearDependedIssueURLUseCase: ClearDependedIssueURLUseCase;
    readonly createEstimationIssueUseCase: CreateEstimationIssueUseCase;
    readonly convertCheckboxToIssueInStoryIssueUseCase: ConvertCheckboxToIssueInStoryIssueUseCase;
    readonly changeStatusByStoryColorUseCase: ChangeStatusByStoryColorUseCase;
    readonly setNoStoryIssueToStoryUseCase: SetNoStoryIssueToStoryUseCase;
    readonly createNewStoryByLabelUseCase: CreateNewStoryByLabelUseCase;
    readonly assignNoAssigneeIssueToManagerUseCase: AssignNoAssigneeIssueToManagerUseCase;
    readonly updateIssueStatusByLabelUseCase: UpdateIssueStatusByLabelUseCase;
    readonly dateRepository: DateRepository;
    readonly spreadsheetRepository: SpreadsheetRepository;
    readonly projectRepository: ProjectRepository;
    readonly issueRepository: IssueRepository;
    constructor(actionAnnouncementUseCase: ActionAnnouncementUseCase, setWorkflowManagementIssueToStoryUseCase: SetWorkflowManagementIssueToStoryUseCase, clearNextActionHourUseCase: ClearNextActionHourUseCase, analyzeProblemByIssueUseCase: AnalyzeProblemByIssueUseCase, analyzeStoriesUseCase: AnalyzeStoriesUseCase, clearDependedIssueURLUseCase: ClearDependedIssueURLUseCase, createEstimationIssueUseCase: CreateEstimationIssueUseCase, convertCheckboxToIssueInStoryIssueUseCase: ConvertCheckboxToIssueInStoryIssueUseCase, changeStatusByStoryColorUseCase: ChangeStatusByStoryColorUseCase, setNoStoryIssueToStoryUseCase: SetNoStoryIssueToStoryUseCase, createNewStoryByLabelUseCase: CreateNewStoryByLabelUseCase, assignNoAssigneeIssueToManagerUseCase: AssignNoAssigneeIssueToManagerUseCase, updateIssueStatusByLabelUseCase: UpdateIssueStatusByLabelUseCase, dateRepository: DateRepository, spreadsheetRepository: SpreadsheetRepository, projectRepository: ProjectRepository, issueRepository: IssueRepository);
    run: (input: {
        projectName: string;
        org: string;
        projectUrl: string;
        manager: Member["name"];
        workingReport: {
            repo: string;
            members: Member["name"][];
            spreadsheetUrl: string;
        };
        urlOfStoryView: string;
        disabledStatus: string;
        defaultStatus: string | null;
    }) => Promise<{
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        targetDateTimes: Date[];
        storyIssues: StoryObjectMap;
    }>;
    runEachUseCases: (input: Parameters<HandleScheduledEventUseCase["run"]>[0], project: Project, issues: Issue[], cacheUsed: boolean, targetDateTimes: Date[], storyObjectMap: StoryObjectMap) => Promise<void>;
    static createTargetDateTimes: (from: Date, to: Date) => Date[];
    findTargetDateAndUpdateLastExecutionDateTime: (spreadsheetUrl: string, now: Date) => Promise<Date[]>;
    storyIssues: (input: {
        project: Project;
        issues: Issue[];
    }) => Promise<StoryObjectMap>;
}
//# sourceMappingURL=HandleScheduledEventUseCase.d.ts.map