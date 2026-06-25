import type { Issue } from '../../../domain/entities/Issue';
import type { Project } from '../../../domain/entities/Project';
export type InTmuxByHumanDataWriterParams = {
    inTmuxDataOutputDir: string | null | undefined;
    inTmuxConsoleBaseUrl: string | null | undefined;
    inTmuxConsoleToken: string | null | undefined;
    inTmuxProjectOrder: string[] | null | undefined;
    pjcode: string | null | undefined;
    assigneeLogin: string | null | undefined;
    org: string;
    repo: string;
    project: Project;
    issues: Issue[];
    now: Date;
};
export declare const writeInTmuxByHumanData: (params: InTmuxByHumanDataWriterParams) => void;
//# sourceMappingURL=inTmuxByHumanDataWriter.d.ts.map