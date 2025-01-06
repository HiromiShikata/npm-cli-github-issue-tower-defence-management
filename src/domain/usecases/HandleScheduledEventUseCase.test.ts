import { HandleScheduledEventUseCase } from './HandleScheduledEventUseCase';

describe('HandleScheduledEventUseCase', () => {
  describe('createTargetDateTimes', () => {
    const testCases: {
      lastExecutionDateTime: Date;
      now: Date;
      expected: Date[];
    }[] = [
      {
        lastExecutionDateTime: new Date('2021-01-01T00:00:00Z'),
        now: new Date('2021-01-01T00:00:00Z'),
        expected: [],
      },
      {
        lastExecutionDateTime: new Date('2021-01-01T00:00:00Z'),
        now: new Date('2021-01-01T00:00:01Z'),
        expected: [],
      },
      {
        lastExecutionDateTime: new Date('2021-01-01T00:00:00Z'),
        now: new Date('2020-01-01T00:00:02Z'),
        expected: [new Date('2020-01-01T00:00:00Z')],
      },
      {
        lastExecutionDateTime: new Date('2021-01-01T00:00:00Z'),
        now: new Date('2021-01-01T00:05:00Z'),
        expected: [
          new Date('2021-01-01T00:01:00Z'),
          new Date('2021-01-01T00:02:00Z'),
          new Date('2021-01-01T00:03:00Z'),
          new Date('2021-01-01T00:04:00Z'),
          new Date('2021-01-01T00:05:00Z'),
        ],
      },
      {
        lastExecutionDateTime: new Date('2021-01-01T00:00:00Z'),
        now: new Date('2022-01-01T00:00:00Z'),
        expected: Array(300)
          .fill(0)
          .map((_, i) => {
            const d = new Date('2021-01-01T00:00:00Z');
            d.setTime(d.getTime() + (i + 1) * 60 * 1000);
            return d;
          }),
      },
    ];
    testCases.forEach((testCase) => {
      it(`should return ${testCase.expected.map((d) => d.toISOString()).join(',')} when lastExecutionDateTime is ${testCase.lastExecutionDateTime.toISOString()} and now is ${testCase.now.toISOString()}`, () => {
        const result = HandleScheduledEventUseCase.createTargetDateTimes(
          testCase.lastExecutionDateTime,
          testCase.now,
        );
        expect(result).toEqual(testCase.expected);
      });
    });
  });
});
