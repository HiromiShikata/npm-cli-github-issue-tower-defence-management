import { GithubRepository } from './GithubRepository';

describe('GithubRepository', () => {
  describe('convertIsoToHhmm', () => {
    test.each`
      isoString                 | expected
      ${'2022-01-01T00:00:00Z'} | ${'00:00'}
      ${'2022-01-01T01:00:00Z'} | ${'01:00'}
      ${'2022-01-01T01:01:00Z'} | ${'01:01'}
      ${'2022-01-01T01:01:01Z'} | ${'01:01'}
    `(
      'convertIsoToHhmm',
      ({ isoString, expected }: { isoString: string; expected: string }) => {
        const githubRepository = new GithubRepository();
        expect(githubRepository.convertIsoToHhmm(isoString)).toBe(expected);
      },
    );
  });
  describe('calculateDuration', () => {
    test.each`
      startIsoString            | endIsoString              | expected
      ${'2022-01-01T00:00:00Z'} | ${'2022-01-01T00:00:00Z'} | ${'00:00'}
      ${'2022-01-01T00:00:00Z'} | ${'2022-01-01T01:00:00Z'} | ${'01:00'}
      ${'2022-01-01T00:00:00Z'} | ${'2022-01-01T01:01:00Z'} | ${'01:01'}
      ${'2022-01-01T00:00:00Z'} | ${'2022-01-01T01:01:01Z'} | ${'01:01'}
    `(
      'calculateDuration',
      ({
        startIsoString,
        endIsoString,
        expected,
      }: {
        startIsoString: string;
        endIsoString: string;
        expected: string;
      }) => {
        const githubRepository = new GithubRepository();
        expect(
          githubRepository.calculateDuration(startIsoString, endIsoString),
        ).toBe(expected);
      },
    );
  });
  describe('calculateTotalHhmm', () => {
    test.each`
      timelineEvents | expected
      ${[
  {
    durationHhmm: '01:00',
  },
]} | ${'01:00'}
    `(
      'calculateTotalHhmm',
      ({
        timelineEvents,
        expected,
      }: {
        timelineEvents: {
          durationHhmm: string;
        }[];
        expected: string;
      }) => {
        const githubRepository = new GithubRepository();
        expect(
          githubRepository.calculateTotalHhmm(
            timelineEvents.map((timelineEvent) => ({
              issueUrl: '',
              startHhmm: '',
              endHhmm: '',
              ...timelineEvent,
            })),
          ),
        ).toBe(expected);
      },
    );
  });
});
