import { resolveAllowedIssueAuthors } from './resolveAllowedIssueAuthors';

describe('resolveAllowedIssueAuthors', () => {
  it('returns the top-level value when it is present', () => {
    expect(
      resolveAllowedIssueAuthors({
        topLevel: ['owner'],
        startPreparation: ['nested'],
      }),
    ).toEqual(['owner']);
  });

  it('falls back to the startPreparation value when the top-level value is null', () => {
    expect(
      resolveAllowedIssueAuthors({
        topLevel: null,
        startPreparation: ['nested'],
      }),
    ).toEqual(['nested']);
  });

  it('falls back to the startPreparation value when the top-level value is undefined', () => {
    expect(
      resolveAllowedIssueAuthors({
        startPreparation: ['nested'],
      }),
    ).toEqual(['nested']);
  });

  it('returns null when neither value is present', () => {
    expect(resolveAllowedIssueAuthors({})).toBeNull();
  });

  it('returns null when both values are null', () => {
    expect(
      resolveAllowedIssueAuthors({
        topLevel: null,
        startPreparation: null,
      }),
    ).toBeNull();
  });

  it('prefers an empty top-level array over the startPreparation fallback', () => {
    expect(
      resolveAllowedIssueAuthors({
        topLevel: [],
        startPreparation: ['nested'],
      }),
    ).toEqual([]);
  });
});
