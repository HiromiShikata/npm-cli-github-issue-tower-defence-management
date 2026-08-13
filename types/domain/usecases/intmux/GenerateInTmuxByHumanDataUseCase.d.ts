import { Issue } from '../../entities/Issue';
import { Project } from '../../entities/Project';
import { UnansweredOwnerCall } from '../../entities/UnansweredOwnerCall';
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
export type InTmuxByHumanSessionV5 = {
    name: string;
    description: string;
    unansweredCalls: UnansweredOwnerCall[];
};
export type InTmuxByHumanGroupV5 = {
    story: string;
    sessions: InTmuxByHumanSessionV5[];
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
export type InTmuxByHumanV5 = {
    version: 5;
    overviewUrl: string;
    tdpmConsoleUrl: string;
    newIssueUrl: string;
    groups: InTmuxByHumanGroupV5[];
};
export type InTmuxByHumanData = {
    v1: InTmuxByHumanGroupV1[];
    v2: InTmuxByHumanGroupV2[];
    v3: InTmuxByHumanV3 | null;
    v4: InTmuxByHumanV4 | null;
    v5: InTmuxByHumanV5 | null;
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
    unansweredCallsByTmuxSessionName: Map<string, UnansweredOwnerCall[]>;
    now: Date;
};
export declare class GenerateInTmuxByHumanDataUseCase {
    run: (input: GenerateInTmuxByHumanDataInput) => InTmuxByHumanData;
    private isInTmuxByHuman;
    private groupByStoryOrder;
}
//# sourceMappingURL=GenerateInTmuxByHumanDataUseCase.d.ts.map