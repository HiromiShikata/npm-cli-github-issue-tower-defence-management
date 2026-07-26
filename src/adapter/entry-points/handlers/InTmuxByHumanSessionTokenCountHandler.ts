import { Issue } from '../../../domain/entities/Issue';
import { ClaudeInteractiveSessionRepository } from '../../../domain/usecases/adapter-interfaces/ClaudeInteractiveSessionRepository';
import { InTmuxByHumanSessionTokenCountUseCase } from '../../../domain/usecases/InTmuxByHumanSessionTokenCountUseCase';
import { OauthTokenCandidate } from '../../../domain/usecases/OauthTokenSelectUseCase';
import { ProcClaudeInteractiveSessionRepository } from '../../repositories/ProcClaudeInteractiveSessionRepository';
import { loadTokenEntries } from '../../proxy/TokenListLoader';
import { resolveTokenListJsonPath } from './OauthTokenSelectHandler';

export type InTmuxByHumanSessionTokenCountHandlerInput = {
  tokenListJsonPath: string | null;
  issues: Issue[];
};

export type InTmuxByHumanSessionTokenCountHandlerOutput = {
  lines: string[];
  diagnostics: string[];
};

export class InTmuxByHumanSessionTokenCountHandler {
  constructor(
    private readonly useCase: InTmuxByHumanSessionTokenCountUseCase = new InTmuxByHumanSessionTokenCountUseCase(),
    private readonly interactiveSessionRepository: ClaudeInteractiveSessionRepository = new ProcClaudeInteractiveSessionRepository(),
  ) {}

  handle = (
    input: InTmuxByHumanSessionTokenCountHandlerInput,
  ): InTmuxByHumanSessionTokenCountHandlerOutput => {
    const tokenListJsonPath = resolveTokenListJsonPath(input.tokenListJsonPath);
    if (tokenListJsonPath === null) {
      return {
        lines: [],
        diagnostics: [
          'No token list path provided. Pass --tokenListJsonPath or set CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH.',
        ],
      };
    }

    const entries = loadTokenEntries(tokenListJsonPath);
    if (entries === null) {
      return {
        lines: [],
        diagnostics: [
          `No usable token entries loaded from ${tokenListJsonPath}.`,
        ],
      };
    }

    const candidates: OauthTokenCandidate[] = entries.map(
      ({ name, token }) => ({
        name,
        token,
        snapshot: null,
        subscriptionDisabled: false,
        unifiedRejected: false,
        fableRejected: false,
      }),
    );

    const interactiveSessions =
      this.interactiveSessionRepository.listInteractiveSessions();

    const result = this.useCase.run(
      candidates,
      interactiveSessions,
      input.issues,
    );

    const lines = result.counts.map((count) => `${count.name}\t${count.count}`);

    const totalSessions = result.counts.reduce(
      (sum, count) => sum + count.count,
      0,
    );
    const diagnostics = [
      `Counted ${totalSessions} live In-Tmux-by-human session(s) across ${result.counts.length} token(s).`,
    ];

    return { lines, diagnostics };
  };
}
