import type { Issue } from '../../../domain/entities/Issue';
import type { Project } from '../../../domain/entities/Project';
export type ConsoleListsWriterParams = {
    consoleDataOutputDir: string | null | undefined;
    pjcode: string | null | undefined;
    assigneeLogin: string | null | undefined;
    project: Project;
    issues: Issue[];
    generatedAt?: string;
};
export declare const formatConsoleGeneratedAt: (date: Date) => string;
export declare const writeConsoleLists: (params: ConsoleListsWriterParams) => void;
//# sourceMappingURL=consoleListsWriter.d.ts.map