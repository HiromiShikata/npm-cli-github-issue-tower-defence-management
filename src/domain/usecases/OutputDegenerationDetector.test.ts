import {
  OutputDegenerationDetector,
  OUTPUT_DEGENERATION_REPEAT_THRESHOLD,
  OUTPUT_DEGENERATION_DOMINATION_FRACTION,
  OUTPUT_DEGENERATION_MAX_TOKEN_LENGTH,
  OUTPUT_DEGENERATION_ABSOLUTE_RUN_THRESHOLD,
  OUTPUT_DEGENERATION_REP4_THRESHOLD,
  OUTPUT_DEGENERATION_REP4_MIN_TOKENS,
  OUTPUT_DEGENERATION_CROSS_TURN_WINDOW,
  OUTPUT_DEGENERATION_CROSS_TURN_MIN_TURNS,
} from './OutputDegenerationDetector';

const repeat = (token: string, count: number): string =>
  Array.from({ length: count }, () => token).join(' ');

describe('OutputDegenerationDetector', () => {
  const detector = new OutputDegenerationDetector();

  describe('ported constants match the validated Python values', () => {
    it('exposes the exact thresholds', () => {
      expect(OUTPUT_DEGENERATION_REPEAT_THRESHOLD).toBe(5);
      expect(OUTPUT_DEGENERATION_DOMINATION_FRACTION).toBe(0.8);
      expect(OUTPUT_DEGENERATION_MAX_TOKEN_LENGTH).toBe(32);
      expect(OUTPUT_DEGENERATION_ABSOLUTE_RUN_THRESHOLD).toBe(15);
      expect(OUTPUT_DEGENERATION_REP4_THRESHOLD).toBe(0.3);
      expect(OUTPUT_DEGENERATION_REP4_MIN_TOKENS).toBe(40);
      expect(OUTPUT_DEGENERATION_CROSS_TURN_WINDOW).toBe(10);
      expect(OUTPUT_DEGENERATION_CROSS_TURN_MIN_TURNS).toBe(4);
    });
  });

  describe('isIntraTurnDegeneration', () => {
    it('fires on a turn dominated by a single short repeated token (positive)', () => {
      expect(detector.isIntraTurnDegeneration(repeat('court', 40))).toBe(true);
    });

    it('does not fire on a short run just below the repeat threshold (negative)', () => {
      expect(detector.isIntraTurnDegeneration(repeat('court', 4))).toBe(false);
    });

    it('does not fire on healthy prose with no repetition', () => {
      const healthy =
        'I finished the migration and verified the results against the seed data. The build passed and the report is uploaded.';
      expect(detector.isIntraTurnDegeneration(healthy)).toBe(false);
    });

    it('fires exactly at the domination-fraction boundary (run 5 of 6 tokens)', () => {
      expect(
        detector.isIntraTurnDegeneration('count count count count count alpha'),
      ).toBe(true);
    });

    it('does not fire just past the domination-fraction boundary (run 5 of 7 tokens)', () => {
      expect(
        detector.isIntraTurnDegeneration(
          'count count count count count alpha beta',
        ),
      ).toBe(false);
    });

    it('fires on a large absolute run even when domination fails', () => {
      const buried = `${repeat('court', 15)} ${repeat('distinct', 1)} one two three four five`;
      expect(detector.isIntraTurnDegeneration(buried)).toBe(true);
    });

    it('fires on a repeated phrase loop via duplicated 4-gram density', () => {
      const phraseLoop = repeat('the quick brown fox', 15);
      expect(detector.isIntraTurnDegeneration(phraseLoop)).toBe(true);
    });

    it('does not fire on a non-dominating repeat run confined to a fenced code block', () => {
      const variedProse = Array.from(
        { length: 100 },
        (_unused, index) => `word${index}`,
      ).join(' ');
      const withCodeBlock = `${variedProse}\n\`\`\`\n${repeat('court', 20)}\n\`\`\``;
      expect(detector.isIntraTurnDegeneration(withCodeBlock)).toBe(false);
    });

    it('ignores repeated long tokens above the max token length', () => {
      const longToken = 'a'.repeat(OUTPUT_DEGENERATION_MAX_TOKEN_LENGTH + 1);
      expect(detector.isIntraTurnDegeneration(repeat(longToken, 40))).toBe(
        false,
      );
    });

    it('returns false for an empty turn', () => {
      expect(detector.isIntraTurnDegeneration('')).toBe(false);
    });
  });

  describe('maxConsecutiveShortTokenRun', () => {
    it('reports the dominating token and run length for logging', () => {
      const result = detector.maxConsecutiveShortTokenRun(repeat('court', 12));
      expect(result.token).toBe('court');
      expect(result.run).toBe(12);
      expect(result.total).toBe(12);
    });
  });

  describe('detectCrossTurnDegeneration', () => {
    const cleanEnding = (index: number): string =>
      `Turn ${index}: I completed the step and reported the result.`;
    const trailingTokenTurn = (index: number, token: string): string =>
      `Turn ${index}: real message here.\n\n${token}`;

    it('fires when the same trailing token recurs in 4 of the last 10 turns', () => {
      const turns = [
        trailingTokenTurn(1, 'court'),
        cleanEnding(2),
        trailingTokenTurn(3, 'court'),
        cleanEnding(4),
        trailingTokenTurn(5, 'court'),
        cleanEnding(6),
        trailingTokenTurn(7, 'court'),
        cleanEnding(8),
        cleanEnding(9),
        cleanEnding(10),
      ];
      const result = detector.detectCrossTurnDegeneration(turns);
      expect(result).not.toBeNull();
      expect(result?.token).toBe('court');
      expect(result?.turnCount).toBe(4);
    });

    it('does not fire when the trailing token recurs in only 3 of 10 turns', () => {
      const turns = [
        trailingTokenTurn(1, 'court'),
        cleanEnding(2),
        trailingTokenTurn(3, 'court'),
        cleanEnding(4),
        trailingTokenTurn(5, 'court'),
        cleanEnding(6),
        cleanEnding(7),
        cleanEnding(8),
        cleanEnding(9),
        cleanEnding(10),
      ];
      expect(detector.detectCrossTurnDegeneration(turns)).toBeNull();
    });

    it('does not treat a bare URL or multi-word ending as a trailing token', () => {
      const turns = [
        'Done. See https://example.com/report',
        'The work is complete',
        'Result: 42',
        'Done. See https://example.com/report',
      ];
      expect(detector.detectCrossTurnDegeneration(turns)).toBeNull();
    });

    it('only counts turns inside the cross-turn window', () => {
      const withinWindow = Array.from({ length: 10 }, (_unused, index) =>
        index < 3 ? trailingTokenTurn(index, 'court') : cleanEnding(index),
      );
      const beyondWindow = Array.from({ length: 5 }, (_unused, index) =>
        trailingTokenTurn(100 + index, 'court'),
      );
      expect(
        detector.detectCrossTurnDegeneration([
          ...withinWindow,
          ...beyondWindow,
        ]),
      ).toBeNull();
    });
  });
});
