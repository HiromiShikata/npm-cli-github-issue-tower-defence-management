import { Issue, Label } from '../entities/Issue';
import { Member } from '../entities/Member';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { SpreadsheetRepository } from './adapter-interfaces/SpreadsheetRepository';
import { DateRepository } from './adapter-interfaces/DateRepository';
export type WorkingReportTimelineEvent = {
  issueUrl: string;
  issueTitle: string;
  startHhmm: string;
  endHhmm: string;
  durationHhmm: string;
  warnings: string[];
  labels: string[];
  nameWithOwner: string;
};
export declare class GenerateWorkingTimeReportUseCase {
  readonly issueRepository: IssueRepository;
  readonly spreadsheetRepository: SpreadsheetRepository;
  readonly dateRepository: DateRepository;
  constructor(
    issueRepository: IssueRepository,
    spreadsheetRepository: SpreadsheetRepository,
    dateRepository: DateRepository,
  );
  run: (input: {
    issues: Issue[];
    members: Member['name'][];
    manager: Member['name'];
    spreadsheetUrl: string;
    reportIssueTemplate?: string;
    org: string;
    repo: string;
    reportIssueLabels: Label[];
    warningThresholdHour?: number;
    targetDate: Date;
  }) => Promise<void>;
  getWorkingReportIssueTemplate: (input: {
    reportIssueTemplate?: string;
    manager: Member['name'];
    spreadsheetUrl: string;
  }) => Promise<string>;
  createIssueForEachAuthor: (
    author: string,
    date: Date,
    issues: Issue[],
    org: string,
    repo: string,
    labels: Label[],
    workingReportIssueTemplate: string,
    workingTimeThresholdHour?: number,
  ) => Promise<string[][]>;
  filterTimelineAndSortByAuthor: (
    issues: Issue[],
    targetDate: Date,
    author: Member['name'],
    workingTimeThresholdHour: number,
  ) => WorkingReportTimelineEvent[];
  convertIsoToHhmm: (isoString: string) => string;
  calculateDuration: (startIsoString: string, endIsoString: string) => string;
  calculateTotalHhmm: (timelineEvents: WorkingReportTimelineEvent[]) => string;
  applyToTimelineDetails: (
    timelineEvents: WorkingReportTimelineEvent[],
  ) => string;
  applyToTimelineDetail: (timelineEvents: WorkingReportTimelineEvent) => string;
  applyReplacementToTemplate: (input: {
    template: string;
    replacement: Record<string, string>;
  }) => string;
}
//# sourceMappingURL=GenerateWorkingTimeReportUseCase.d.ts.map
