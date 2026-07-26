import { CrossTurnDegeneration } from '../entities/OutputDegeneration';
export declare const OUTPUT_DEGENERATION_REPEAT_THRESHOLD = 5;
export declare const OUTPUT_DEGENERATION_DOMINATION_FRACTION = 0.8;
export declare const OUTPUT_DEGENERATION_MAX_TOKEN_LENGTH = 32;
export declare const OUTPUT_DEGENERATION_ABSOLUTE_RUN_THRESHOLD = 15;
export declare const OUTPUT_DEGENERATION_REP4_THRESHOLD = 0.3;
export declare const OUTPUT_DEGENERATION_REP4_MIN_TOKENS = 40;
export declare const OUTPUT_DEGENERATION_CROSS_TURN_WINDOW = 10;
export declare const OUTPUT_DEGENERATION_CROSS_TURN_MIN_TURNS = 4;
export type ShortTokenRun = {
    token: string | null;
    run: number;
    total: number;
};
export declare class OutputDegenerationDetector {
    private readonly repeatThreshold;
    private readonly dominationFraction;
    private readonly maxTokenLength;
    private readonly absoluteRunThreshold;
    private readonly rep4Threshold;
    private readonly rep4MinTokens;
    private readonly crossTurnWindow;
    private readonly crossTurnMinTurns;
    constructor(repeatThreshold?: number, dominationFraction?: number, maxTokenLength?: number, absoluteRunThreshold?: number, rep4Threshold?: number, rep4MinTokens?: number, crossTurnWindow?: number, crossTurnMinTurns?: number);
    maxConsecutiveShortTokenRun: (text: string) => ShortTokenRun;
    isIntraTurnDegeneration: (text: string) => boolean;
    detectCrossTurnDegeneration: (texts: string[]) => CrossTurnDegeneration | null;
    private stripRepetitionExemptSpans;
    private duplicateNgramFraction;
    private trailingSpuriousToken;
}
//# sourceMappingURL=OutputDegenerationDetector.d.ts.map