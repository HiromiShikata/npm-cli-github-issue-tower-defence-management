import { Issue } from '../../../domain/entities/Issue';
import { ClaudeInteractiveSessionRepository } from '../../../domain/usecases/adapter-interfaces/ClaudeInteractiveSessionRepository';
import { InTmuxByHumanSessionTokenCountUseCase } from '../../../domain/usecases/InTmuxByHumanSessionTokenCountUseCase';
export type InTmuxByHumanSessionTokenCountHandlerInput = {
    tokenListJsonPath: string | null;
    issues: Issue[];
};
export type InTmuxByHumanSessionTokenCountHandlerOutput = {
    lines: string[];
    diagnostics: string[];
};
export declare class InTmuxByHumanSessionTokenCountHandler {
    private readonly useCase;
    private readonly interactiveSessionRepository;
    constructor(useCase?: InTmuxByHumanSessionTokenCountUseCase, interactiveSessionRepository?: ClaudeInteractiveSessionRepository);
    handle: (input: InTmuxByHumanSessionTokenCountHandlerInput) => InTmuxByHumanSessionTokenCountHandlerOutput;
}
//# sourceMappingURL=InTmuxByHumanSessionTokenCountHandler.d.ts.map