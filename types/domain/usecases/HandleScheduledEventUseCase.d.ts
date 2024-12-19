import { Issue, Label } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { GenerateWorkingTimeReportUseCase } from './GenerateWorkingTimeReportUseCase';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { SpreadsheetRepository } from './adapter-interfaces/SpreadsheetRepository';
import { ActionAnnouncementUseCase } from './ActionAnnouncementUseCase';
import { SetWorkflowManagementIssueToStoryUseCase } from './SetWorkflowManagementIssueToStoryUseCase';
import { ClearNextActionHourUseCase } from './ClearNextActionHourUseCase';
import { AnalyzeProblemByIssueUseCase } from './AnalyzeProblemByIssueUseCase';
export declare class ProjectNotFoundError extends Error {
    constructor(message: string);
}
export declare class HandleScheduledEventUseCase {
    readonly generateWorkingTimeReportUseCase: GenerateWorkingTimeReportUseCase;
    readonly actionAnnouncementUseCase: ActionAnnouncementUseCase;
    readonly setWorkflowManagementIssueToStoryUseCase: SetWorkflowManagementIssueToStoryUseCase;
    readonly clearNextActionHourUseCase: ClearNextActionHourUseCase;
    readonly analyzeProblemByIssueUseCase: AnalyzeProblemByIssueUseCase;
    readonly dateRepository: DateRepository;
    readonly spreadsheetRepository: SpreadsheetRepository;
    readonly projectRepository: ProjectRepository;
    readonly issueRepository: IssueRepository;
    constructor(generateWorkingTimeReportUseCase: GenerateWorkingTimeReportUseCase, actionAnnouncementUseCase: ActionAnnouncementUseCase, setWorkflowManagementIssueToStoryUseCase: SetWorkflowManagementIssueToStoryUseCase, clearNextActionHourUseCase: ClearNextActionHourUseCase, analyzeProblemByIssueUseCase: AnalyzeProblemByIssueUseCase, dateRepository: DateRepository, spreadsheetRepository: SpreadsheetRepository, projectRepository: ProjectRepository, issueRepository: IssueRepository);
    run: (input: {
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
    }) => Promise<{
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        targetDateTimes: Date[];
    }>;
    runForTargetDateTime: (input: {
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
}
//# sourceMappingURL=HandleScheduledEventUseCase.d.ts.map