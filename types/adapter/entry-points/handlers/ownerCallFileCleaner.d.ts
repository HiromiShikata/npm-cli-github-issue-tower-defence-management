import { Issue } from '../../../domain/entities/Issue';
export type CleanClosedIssueOwnerCallFilesParams = {
    inTmuxDataOutputDir: string | null | undefined;
    pjcode: string | null | undefined;
    issues: Issue[];
};
export declare const cleanClosedIssueOwnerCallFiles: (params: CleanClosedIssueOwnerCallFilesParams) => void;
//# sourceMappingURL=ownerCallFileCleaner.d.ts.map