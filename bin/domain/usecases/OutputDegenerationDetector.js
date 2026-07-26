"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputDegenerationDetector = exports.OUTPUT_DEGENERATION_CROSS_TURN_MIN_TURNS = exports.OUTPUT_DEGENERATION_CROSS_TURN_WINDOW = exports.OUTPUT_DEGENERATION_REP4_MIN_TOKENS = exports.OUTPUT_DEGENERATION_REP4_THRESHOLD = exports.OUTPUT_DEGENERATION_ABSOLUTE_RUN_THRESHOLD = exports.OUTPUT_DEGENERATION_MAX_TOKEN_LENGTH = exports.OUTPUT_DEGENERATION_DOMINATION_FRACTION = exports.OUTPUT_DEGENERATION_REPEAT_THRESHOLD = void 0;
exports.OUTPUT_DEGENERATION_REPEAT_THRESHOLD = 5;
exports.OUTPUT_DEGENERATION_DOMINATION_FRACTION = 0.8;
exports.OUTPUT_DEGENERATION_MAX_TOKEN_LENGTH = 32;
exports.OUTPUT_DEGENERATION_ABSOLUTE_RUN_THRESHOLD = 15;
exports.OUTPUT_DEGENERATION_REP4_THRESHOLD = 0.3;
exports.OUTPUT_DEGENERATION_REP4_MIN_TOKENS = 40;
exports.OUTPUT_DEGENERATION_CROSS_TURN_WINDOW = 10;
exports.OUTPUT_DEGENERATION_CROSS_TURN_MIN_TURNS = 4;
const LIST_ITEM_LINE_PATTERN = /^\s*(?:[-*+]\s|\d+[.)]\s)/;
const TRAILING_ALPHA_TOKEN_PATTERN = /^[A-Za-z]+$/;
const splitTokens = (text) => text.split(/\s+/).filter((token) => token.length > 0);
const splitLines = (text) => text.split(/\r\n|\r|\n/);
class OutputDegenerationDetector {
    constructor(repeatThreshold = exports.OUTPUT_DEGENERATION_REPEAT_THRESHOLD, dominationFraction = exports.OUTPUT_DEGENERATION_DOMINATION_FRACTION, maxTokenLength = exports.OUTPUT_DEGENERATION_MAX_TOKEN_LENGTH, absoluteRunThreshold = exports.OUTPUT_DEGENERATION_ABSOLUTE_RUN_THRESHOLD, rep4Threshold = exports.OUTPUT_DEGENERATION_REP4_THRESHOLD, rep4MinTokens = exports.OUTPUT_DEGENERATION_REP4_MIN_TOKENS, crossTurnWindow = exports.OUTPUT_DEGENERATION_CROSS_TURN_WINDOW, crossTurnMinTurns = exports.OUTPUT_DEGENERATION_CROSS_TURN_MIN_TURNS) {
        this.repeatThreshold = repeatThreshold;
        this.dominationFraction = dominationFraction;
        this.maxTokenLength = maxTokenLength;
        this.absoluteRunThreshold = absoluteRunThreshold;
        this.rep4Threshold = rep4Threshold;
        this.rep4MinTokens = rep4MinTokens;
        this.crossTurnWindow = crossTurnWindow;
        this.crossTurnMinTurns = crossTurnMinTurns;
        this.maxConsecutiveShortTokenRun = (text) => {
            let bestToken = null;
            let bestRun = 0;
            let totalTokens = 0;
            let currentToken = null;
            let currentRun = 0;
            for (const token of splitTokens(text)) {
                totalTokens += 1;
                if (token.length > this.maxTokenLength) {
                    currentToken = null;
                    currentRun = 0;
                    continue;
                }
                if (token === currentToken) {
                    currentRun += 1;
                }
                else {
                    currentToken = token;
                    currentRun = 1;
                }
                if (currentRun > bestRun) {
                    bestRun = currentRun;
                    bestToken = currentToken;
                }
            }
            return { token: bestToken, run: bestRun, total: totalTokens };
        };
        this.isIntraTurnDegeneration = (text) => {
            const { run, total } = this.maxConsecutiveShortTokenRun(text);
            if (total === 0) {
                return false;
            }
            if (run >= this.repeatThreshold && run >= this.dominationFraction * total) {
                return true;
            }
            const filtered = this.stripRepetitionExemptSpans(text);
            const filteredRun = this.maxConsecutiveShortTokenRun(filtered);
            if (filteredRun.run >= this.absoluteRunThreshold) {
                return true;
            }
            if (filteredRun.total >= this.rep4MinTokens &&
                this.duplicateNgramFraction(filtered, 4) >= this.rep4Threshold) {
                return true;
            }
            return false;
        };
        this.detectCrossTurnDegeneration = (texts) => {
            const counts = new Map();
            for (const text of texts.slice(0, this.crossTurnWindow)) {
                const token = this.trailingSpuriousToken(text);
                if (token === null) {
                    continue;
                }
                counts.set(token, (counts.get(token) ?? 0) + 1);
            }
            let bestToken = null;
            let bestCount = 0;
            for (const [token, count] of counts) {
                if (count > bestCount) {
                    bestCount = count;
                    bestToken = token;
                }
            }
            if (bestToken !== null && bestCount >= this.crossTurnMinTurns) {
                return { token: bestToken, turnCount: bestCount };
            }
            return null;
        };
        this.stripRepetitionExemptSpans = (text) => {
            const keptLines = [];
            let inFence = false;
            for (const line of splitLines(text)) {
                const stripped = line.trim();
                if (stripped.startsWith('```') || stripped.startsWith('~~~')) {
                    inFence = !inFence;
                    continue;
                }
                if (inFence) {
                    continue;
                }
                if (line.includes('|')) {
                    continue;
                }
                if (LIST_ITEM_LINE_PATTERN.test(line)) {
                    continue;
                }
                keptLines.push(line);
            }
            return keptLines.join('\n');
        };
        this.duplicateNgramFraction = (text, n) => {
            const tokens = splitTokens(text).filter((token) => token.length <= this.maxTokenLength);
            if (tokens.length < n + 1) {
                return 0;
            }
            const ngrams = [];
            for (let index = 0; index <= tokens.length - n; index += 1) {
                ngrams.push(tokens.slice(index, index + n).join('\u0000'));
            }
            const total = ngrams.length;
            if (total < 2) {
                return 0;
            }
            const unique = new Set(ngrams).size;
            return 1 - unique / total;
        };
        this.trailingSpuriousToken = (text) => {
            const stripped = text.replace(/\s+$/, '');
            if (stripped.length === 0) {
                return null;
            }
            const lines = splitLines(stripped);
            const lastLine = lines[lines.length - 1].trim();
            if (lastLine.length === 0 || lastLine.length > this.maxTokenLength) {
                return null;
            }
            if (!TRAILING_ALPHA_TOKEN_PATTERN.test(lastLine)) {
                return null;
            }
            return lastLine;
        };
    }
}
exports.OutputDegenerationDetector = OutputDegenerationDetector;
//# sourceMappingURL=OutputDegenerationDetector.js.map