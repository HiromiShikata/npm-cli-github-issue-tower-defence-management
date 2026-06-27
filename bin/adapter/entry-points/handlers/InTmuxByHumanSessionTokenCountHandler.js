"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InTmuxByHumanSessionTokenCountHandler = void 0;
const InTmuxByHumanSessionTokenCountUseCase_1 = require("../../../domain/usecases/InTmuxByHumanSessionTokenCountUseCase");
const ProcClaudeInteractiveSessionRepository_1 = require("../../repositories/ProcClaudeInteractiveSessionRepository");
const TokenListLoader_1 = require("../../proxy/TokenListLoader");
const OauthTokenSelectHandler_1 = require("./OauthTokenSelectHandler");
class InTmuxByHumanSessionTokenCountHandler {
    constructor(useCase = new InTmuxByHumanSessionTokenCountUseCase_1.InTmuxByHumanSessionTokenCountUseCase(), interactiveSessionRepository = new ProcClaudeInteractiveSessionRepository_1.ProcClaudeInteractiveSessionRepository()) {
        this.useCase = useCase;
        this.interactiveSessionRepository = interactiveSessionRepository;
        this.handle = (input) => {
            const tokenListJsonPath = (0, OauthTokenSelectHandler_1.resolveTokenListJsonPath)(input.tokenListJsonPath);
            if (tokenListJsonPath === null) {
                return {
                    lines: [],
                    diagnostics: [
                        'No token list path provided. Pass --tokenListJsonPath or set CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH.',
                    ],
                };
            }
            const entries = (0, TokenListLoader_1.loadTokenEntries)(tokenListJsonPath);
            if (entries === null) {
                return {
                    lines: [],
                    diagnostics: [
                        `No usable token entries loaded from ${tokenListJsonPath}.`,
                    ],
                };
            }
            const candidates = entries.map(({ name, token }) => ({
                name,
                token,
                snapshot: null,
                subscriptionDisabled: false,
                unifiedRejected: false,
            }));
            const interactiveSessions = this.interactiveSessionRepository.listInteractiveSessions();
            const result = this.useCase.run(candidates, interactiveSessions, input.issues);
            const lines = result.counts.map((count) => `${count.name}\t${count.count}`);
            const totalSessions = result.counts.reduce((sum, count) => sum + count.count, 0);
            const diagnostics = [
                `Counted ${totalSessions} live In-Tmux-by-human session(s) across ${result.counts.length} token(s).`,
            ];
            return { lines, diagnostics };
        };
    }
}
exports.InTmuxByHumanSessionTokenCountHandler = InTmuxByHumanSessionTokenCountHandler;
//# sourceMappingURL=InTmuxByHumanSessionTokenCountHandler.js.map