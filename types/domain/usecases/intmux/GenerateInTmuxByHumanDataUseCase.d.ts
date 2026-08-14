import { Issue } from '../../entities/Issue';
import { Project } from '../../entities/Project';
export type InTmuxByHumanUrlEntry = {
    url: string;
    title: string;
};
export type InTmuxByHumanGroupV1 = {
    story: string;
    urls: string[];
};
export type InTmuxByHumanGroupV2 = {
    story: string;
    urls: InTmuxByHumanUrlEntry[];
};
export type InTmuxByHumanSession = {
    name: string;
    description: string;
};
export type InTmuxByHumanGroupV4 = {
    story: string;
    sessions: InTmuxByHumanSession[];
};
export type InTmuxByHumanV3 = {
    version: 3;
    overviewUrl: string;
    tdpmConsoleUrl: string;
    groups: InTmuxByHumanGroupV2[];
};
export type InTmuxByHumanV4 = {
    version: 4;
    overviewUrl: string;
    tdpmConsoleUrl: string;
    newIssueUrl: string;
    groups: InTmuxByHumanGroupV4[];
};
export type InTmuxByHumanData = {
    v1: InTmuxByHumanGroupV1[];
    v2: InTmuxByHumanGroupV2[];
    v3: InTmuxByHumanV3 | null;
    v4: InTmuxByHumanV4 | null;
};
export type GenerateInTmuxByHumanDataInput = {
    project: Project;
    issues: Issue[];
    pjcode: string;
    assigneeLogin: string;
    org: string;
    repo: string;
    newIssueRepo?: string;
    consoleBaseUrl: string | null;
    consoleToken: string | null;
    now: Date;
};
export declare class GenerateInTmuxByHumanDataUseCase {
    run: (input: GenerateInTmuxByHumanDataInput) => InTmuxByHumanData;
    private isInTmuxByHuman;
    private groupByStoryOrder;
}
//# sourceMappingURL=GenerateInTmuxByHumanDataUseCase.d.ts.map