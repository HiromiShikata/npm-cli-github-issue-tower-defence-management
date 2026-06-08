import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { SpreadsheetRepository } from './adapter-interfaces/SpreadsheetRepository';
import { ActionAnnouncementUseCase } from './ActionAnnouncementUseCase';
import { SetWorkflowManagementIssueToStoryUseCase } from './SetWorkflowManagementIssueToStoryUseCase';
import { ClearPastNextActionDateHourUseCase } from './ClearPastNextActionDateHourUseCase';
import { AnalyzeProblemByIssueUseCase } from './AnalyzeProblemByIssueUseCase';
import { AnalyzeStoriesUseCase } from './AnalyzeStoriesUseCase';
import { ClearDependedIssueURLUseCase } from './ClearDependedIssueURLUseCase';
import { SetDependedIssueUrlForOpenTaskPRsUseCase } from './SetDependedIssueUrlForOpenTaskPRsUseCase';
import { CreateEstimationIssueUseCase } from './CreateEstimationIssueUseCase';
import { ConvertCheckboxToIssueInStoryIssueUseCase } from './ConvertCheckboxToIssueInStoryIssueUseCase';
import { ChangeStatusByStoryColorUseCase } from './ChangeStatusByStoryColorUseCase';
import { SetNoStoryIssueToStoryUseCase } from './SetNoStoryIssueToStoryUseCase';
import { CreateNewStoryByLabelUseCase } from './CreateNewStoryByLabelUseCase';
import { AssignNoAssigneeIssueToManagerUseCase } from './AssignNoAssigneeIssueToManagerUseCase';
import { UpdateIssueStatusByLabelUseCase } from './UpdateIssueStatusByLabelUseCase';
import { RotationOrderEntry, StartPreparationUseCase } from './StartPreparationUseCase';
import { RevertOrphanedPreparationUseCase } from './RevertOrphanedPreparationUseCase';
import { RevertNotReadyAwaitingQualityCheckUseCase } from './RevertNotReadyAwaitingQualityCheckUseCase';
import { SetupTowerDefenceProjectUseCase } from './SetupTowerDefenceProjectUseCase';
import { UpdateRateLimitCacheUseCase } from './UpdateRateLimitCacheUseCase';
export declare class ProjectNotFoundError extends Error {
    constructor(message: string);
}
export declare class HandleScheduledEventUseCase {
    readonly setupTowerDefenceProjectUseCase: SetupTowerDefenceProjectUseCase;
    readonly actionAnnouncementUseCase: ActionAnnouncementUseCase;
    readonly setWorkflowManagementIssueToStoryUseCase: SetWorkflowManagementIssueToStoryUseCase;
    readonly clearPastNextActionUseCase: ClearPastNextActionDateHourUseCase;
    readonly analyzeProblemByIssueUseCase: AnalyzeProblemByIssueUseCase;
    readonly analyzeStoriesUseCase: AnalyzeStoriesUseCase;
    readonly clearDependedIssueURLUseCase: ClearDependedIssueURLUseCase;
    readonly setDependedIssueUrlForOpenTaskPRsUseCase: SetDependedIssueUrlForOpenTaskPRsUseCase;
    readonly createEstimationIssueUseCase: CreateEstimationIssueUseCase;
    readonly convertCheckboxToIssueInStoryIssueUseCase: ConvertCheckboxToIssueInStoryIssueUseCase;
    readonly changeStatusByStoryColorUseCase: ChangeStatusByStoryColorUseCase;
    readonly setNoStoryIssueToStoryUseCase: SetNoStoryIssueToStoryUseCase;
    readonly createNewStoryByLabelUseCase: CreateNewStoryByLabelUseCase;
    readonly assignNoAssigneeIssueToManagerUseCase: AssignNoAssigneeIssueToManagerUseCase;
    readonly updateIssueStatusByLabelUseCase: UpdateIssueStatusByLabelUseCase;
    readonly startPreparationUseCase: StartPreparationUseCase;
    readonly revertOrphanedPreparationUseCase: RevertOrphanedPreparationUseCase;
    readonly revertNotReadyAwaitingQualityCheckUseCase: RevertNotReadyAwaitingQualityCheckUseCase;
    readonly updateRateLimitCacheUseCase: UpdateRateLimitCacheUseCase | null;
    readonly dateRepository: DateRepository;
    readonly spreadsheetRepository: SpreadsheetRepository;
    readonly projectRepository: ProjectRepository;
    readonly issueRepository: IssueRepository;
    constructor(setupTowerDefenceProjectUseCase: SetupTowerDefenceProjectUseCase, actionAnnouncementUseCase: ActionAnnouncementUseCase, setWorkflowManagementIssueToStoryUseCase: SetWorkflowManagementIssueToStoryUseCase, clearPastNextActionUseCase: ClearPastNextActionDateHourUseCase, analyzeProblemByIssueUseCase: AnalyzeProblemByIssueUseCase, analyzeStoriesUseCase: AnalyzeStoriesUseCase, clearDependedIssueURLUseCase: ClearDependedIssueURLUseCase, setDependedIssueUrlForOpenTaskPRsUseCase: SetDependedIssueUrlForOpenTaskPRsUseCase, createEstimationIssueUseCase: CreateEstimationIssueUseCase, convertCheckboxToIssueInStoryIssueUseCase: ConvertCheckboxToIssueInStoryIssueUseCase, changeStatusByStoryColorUseCase: ChangeStatusByStoryColorUseCase, setNoStoryIssueToStoryUseCase: SetNoStoryIssueToStoryUseCase, createNewStoryByLabelUseCase: CreateNewStoryByLabelUseCase, assignNoAssigneeIssueToManagerUseCase: AssignNoAssigneeIssueToManagerUseCase, updateIssueStatusByLabelUseCase: UpdateIssueStatusByLabelUseCase, startPreparationUseCase: StartPreparationUseCase, revertOrphanedPreparationUseCase: RevertOrphanedPreparationUseCase, revertNotReadyAwaitingQualityCheckUseCase: RevertNotReadyAwaitingQualityCheckUseCase, updateRateLimitCacheUseCase: UpdateRateLimitCacheUseCase | null, dateRepository: DateRepository, spreadsheetRepository: SpreadsheetRepository, projectRepository: ProjectRepository, issueRepository: IssueRepository);
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
        disabled: boolean;
        allowIssueCacheMinutes: number;
        startPreparation?: {
            defaultAgentName: string;
            defaultLlmModelName?: string | null;
            fallbackLlmModelName?: string | null;
            defaultLlmAgentName?: string | null;
            configFilePath: string;
            maximumPreparingIssuesCount: number | null;
            utilizationPercentageThreshold?: number;
            allowedIssueAuthors?: string[] | null;
            preparationProcessCheckCommand?: string;
            codexHomeCandidates?: string[] | null;
            awLogDirectoryPath?: string;
            awLogStaleThresholdMinutes?: number;
            awaitingQualityCheckStatus?: string | null;
            labelsAsLlmAgentName?: string[] | null;
        } | null;
        thresholdForAutoReject?: number;
    }) => Promise<{
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        targetDateTimes: Date[];
        storyIssues: StoryObjectMap;
        rotationOrder: RotationOrderEntry[] | null;
    } | null>;
    runEachUseCases: (input: Parameters<HandleScheduledEventUseCase["run"]>[0], project: Project, issues: Issue[], cacheUsed: boolean, targetDateTimes: Date[], storyObjectMap: StoryObjectMap, runSlowSweep: boolean) => Promise<{
        rotationOrder: RotationOrderEntry[] | null;
    }>;
    runSlowSweepUseCases: (input: Parameters<HandleScheduledEventUseCase["run"]>[0], project: Project, issues: Issue[], cacheUsed: boolean, targetDateTimes: Date[], storyObjectMap: StoryObjectMap) => Promise<void>;
    static createTargetDateTimes: (from: Date, to: Date) => Date[];
    runSpreadsheetOperation: <T>(operation: "read" | "write", spreadsheetUrl: string, org: string, repo: string, manager: Member["name"], action: () => Promise<T>) => Promise<T>;
    findTargetDateAndUpdateLastExecutionDateTime: (spreadsheetUrl: string, now: Date, org: string, repo: string, manager: Member["name"]) => Promise<Date[]>;
    shouldRunSlowSweep: (spreadsheetUrl: string, now: Date, org: string, repo: string, manager: Member["name"]) => Promise<boolean>;
    storyIssues: (input: {
        project: Project;
        issues: Issue[];
    }) => Promise<StoryObjectMap>;
}
//# sourceMappingURL=HandleScheduledEventUseCase.d.ts.map