import { calcrateDuration, totalDuration } from './utils';

describe('utils', () => {
  describe('calculateDuration', () => {
    test.each`
      start      | end       | expected
      ${'0:50'}  | ${'1:30'} | ${'00:40'}
      ${'23:50'} | ${'0:00'} | ${'00:10'}
      ${'0:20'}  | ${'0:10'} | ${'23:50'}
    `(
      'should return $expected',
      ({
        start,
        end,
        expected,
      }: {
        start: string;
        end: string;
        expected: string;
      }) => {
        const result = calcrateDuration(start, end);
        expect(result).toEqual(expected);
      },
    );
  });
  describe('totalDuration', () => {
    test.each`
      durations            | expected
      ${['0:50', '1:30']}  | ${'02:20'}
      ${['23:50', '0:00']} | ${'23:50'}
      ${['0:20', '0:10']}  | ${'00:30'}
    `(
      'should return $expected',
      ({ durations, expected }: { durations: string[]; expected: string }) => {
        const result = totalDuration(durations);
        expect(result).toEqual(expected);
      },
    );
  });
});
