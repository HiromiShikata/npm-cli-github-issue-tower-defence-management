import { isTransientApiError } from './isTransientApiError';

describe('isTransientApiError', () => {
  const transientCases: { name: string; error: unknown }[] = [
    {
      name: 'a stale GitHub Project single-select option id',
      error: new Error(
        'The single select option Id does not belong to the field',
      ),
    },
    {
      name: 'a GitHub API rate limit message',
      error: new Error('API rate limit exceeded for installation'),
    },
    {
      name: 'a GitHub bad credentials message',
      error: new Error('Bad credentials'),
    },
    {
      name: 'a GitHub GraphQL transient query failure message',
      error: new Error(
        'Something went wrong while executing your query on 2026-09-09T23:34:05Z. Please include `BE9A:BD63D:2E4757E:95BB975:6AA1ECEC` when reporting this issue.',
      ),
    },
    {
      name: 'an API-prefixed status code not covered by the rate limit check',
      error: new Error('Failed to write to Internal Reporting API: 500'),
    },
    {
      name: 'a ky NetworkError raised after retries are exhausted',
      error: Object.assign(
        new Error(
          'Request failed due to a network error: GET https://api.github.com/users/HiromiShikata/projectsV2/48/fields?per_page=100',
        ),
        { name: 'NetworkError' },
      ),
    },
    {
      name: 'a network-error message whose Error name was not set to NetworkError',
      error: new Error(
        'Request failed due to a network error: GET https://api.github.com/users/HiromiShikata/projectsV2/48/fields?per_page=100',
      ),
    },
  ];

  it.each(transientCases)(
    'returns true for $name',
    ({ error }: { error: unknown }) => {
      expect(isTransientApiError(error)).toBe(true);
    },
  );

  const nonTransientCases: { name: string; error: unknown }[] = [
    {
      name: 'a validation failure message',
      error: new Error("Validation Failed: Title can't be blank"),
    },
    {
      name: 'a thrown non-Error string value',
      error: 'just a plain string, not an Error instance',
    },
    {
      name: 'a colon-prefixed number that is not an API status code',
      error: new Error('Order number: 500'),
    },
  ];

  it.each(nonTransientCases)(
    'returns false for $name',
    ({ error }: { error: unknown }) => {
      expect(isTransientApiError(error)).toBe(false);
    },
  );

  it('does not throw when given a non-Error value', () => {
    expect(() => isTransientApiError('plain string error')).not.toThrow();
    expect(() => isTransientApiError(undefined)).not.toThrow();
    expect(() => isTransientApiError(null)).not.toThrow();
    expect(() => isTransientApiError(42)).not.toThrow();
  });
});
