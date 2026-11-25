export const COMMENTARY_CHUNK_CHARACTERS = 300;

const EMPTY_ANSWER_SENTENCE = 'バックエンドの回答は空でした。';
const BACKEND_FAILURE_SENTENCE_PREFIX =
  'バックエンドの処理に失敗しました。理由は次のとおりです。';

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const splitCommentaryContent = (
  text: string,
  maxCharacters: number,
): string[] => {
  const characters = Array.from(text);
  const chunks: string[] = [];
  for (let index = 0; index < characters.length; index += maxCharacters) {
    chunks.push(characters.slice(index, index + maxCharacters).join(''));
  }
  return chunks;
};

export type VoiceConsoleDelegationBridgeDependencies = {
  sendToBackend: (utterance: string) => Promise<string>;
  appendCommentary: (delegationId: string, content: string) => void;
  newEventId: () => string;
  logError: (message: string) => void;
};

export class VoiceConsoleDelegationBridge {
  private utterance = '';
  private turnTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly dependencies: VoiceConsoleDelegationBridgeDependencies,
  ) {}

  handleOwnerTranscriptDelta(delta: string): void {
    this.utterance += delta;
  }

  handleDelegationCreated(delegationId: string): void {
    const utterance = this.utterance;
    this.utterance = '';
    this.turnTail = this.turnTail
      .then(() => this.runTurn(delegationId, utterance))
      .catch((error: unknown) => {
        this.dependencies.logError(
          `voice console could not report delegation ${delegationId}: ${describeError(error)}`,
        );
      });
  }

  private async runTurn(
    delegationId: string,
    utterance: string,
  ): Promise<void> {
    let answer: string;
    try {
      answer = await this.dependencies.sendToBackend(utterance);
    } catch (error) {
      const reason = describeError(error);
      this.dependencies.logError(
        `voice console backend turn failed for delegation ${delegationId}: ${reason}`,
      );
      this.appendSpoken(
        delegationId,
        `${BACKEND_FAILURE_SENTENCE_PREFIX}${reason}`,
      );
      return;
    }
    this.appendSpoken(
      delegationId,
      answer.length > 0 ? answer : EMPTY_ANSWER_SENTENCE,
    );
  }

  private appendSpoken(delegationId: string, content: string): void {
    for (const chunk of splitCommentaryContent(
      content,
      COMMENTARY_CHUNK_CHARACTERS,
    )) {
      this.dependencies.appendCommentary(delegationId, chunk);
    }
  }
}
