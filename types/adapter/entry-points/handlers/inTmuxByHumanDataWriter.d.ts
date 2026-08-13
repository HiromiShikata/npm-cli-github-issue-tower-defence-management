import type { Issue } from '../../../domain/entities/Issue';
import type { Project } from '../../../domain/entities/Project';
import type { UnansweredOwnerCall } from '../../../domain/entities/UnansweredOwnerCall';
export type InTmuxByHumanDataWriterParams = {
    inTmuxDataOutputDir: string | null | undefined;
    inTmuxConsoleBaseUrl: string | null | undefined;
    inTmuxConsoleToken: string | null | undefined;
    inTmuxProjectOrder: string[] | null | undefined;
    pjcode: string | null | undefined;
    assigneeLogin: string | null | undefined;
    org: string;
    repo: string;
    newIssueRepo?: string | null | undefined;
    project: Project;
    issues: Issue[];
    unansweredCallsByTmuxSessionName?: Map<string, UnansweredOwnerCall[]>;
    now: Date;
};
export declare const writeInTmuxByHumanData: (params: InTmuxByHumanDataWriterParams) => void;
//# sourceMappingURL=inTmuxByHumanDataWriter.d.ts.map