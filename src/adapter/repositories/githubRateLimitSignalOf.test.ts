import { githubRateLimitSignalOf } from './githubRateLimitSignalOf';

const NOW = new Date('2026-10-25T00:00:00.000Z');
const SECONDARY_RATE_LIMIT_BODY = {
  message:
    'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.',
};

const cases = [
  {
    name: 'primary rate limit with x-ratelimit-reset',
    response: {
      status: 403,
      headers: new Headers({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1793000000',
      }),
      body: { message: 'API rate limit exceeded for user.' },
    },
    now: NOW,
    expected: { resetAt: '2026-10-26T07:33:20.000Z' },
  },
  {
    name: 'secondary rate limit as HTTP 403 with retry-after',
    response: {
      status: 403,
      headers: new Headers({ 'retry-after': '60' }),
      body: SECONDARY_RATE_LIMIT_BODY,
    },
    now: NOW,
    expected: { resetAt: '2026-10-25T00:01:00.000Z' },
  },
  {
    name: 'secondary rate limit as HTTP 429 with retry-after',
    response: {
      status: 429,
      headers: new Headers({ 'retry-after': '60' }),
      body: SECONDARY_RATE_LIMIT_BODY,
    },
    now: NOW,
    expected: { resetAt: '2026-10-25T00:01:00.000Z' },
  },
  {
    name: 'HTTP 429 without a reset header',
    response: {
      status: 429,
      headers: new Headers(),
      body: SECONDARY_RATE_LIMIT_BODY,
    },
    now: NOW,
    expected: { resetAt: null },
  },
  {
    name: 'GraphQL RATE_LIMITED error with HTTP 200 and no headers',
    response: {
      status: 200,
      headers: new Headers(),
      body: {
        errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }],
      },
    },
    now: NOW,
    expected: { resetAt: null },
  },
  {
    name: 'primary rate limit prefers x-ratelimit-reset over retry-after',
    response: {
      status: 403,
      headers: new Headers({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1793000000',
        'retry-after': '60',
      }),
      body: { message: 'API rate limit exceeded for user.' },
    },
    now: NOW,
    expected: { resetAt: '2026-10-26T07:33:20.000Z' },
  },
  {
    name: 'HTTP 429 with a non-numeric x-ratelimit-reset is treated as absent',
    response: {
      status: 429,
      headers: new Headers({ 'x-ratelimit-reset': 'soon' }),
      body: SECONDARY_RATE_LIMIT_BODY,
    },
    now: NOW,
    expected: { resetAt: null },
  },
  {
    name: 'HTTP 403 with remaining quota and a permission message',
    response: {
      status: 403,
      headers: new Headers({ 'x-ratelimit-remaining': '4999' }),
      body: { message: 'Resource not accessible by integration' },
    },
    now: NOW,
    expected: null,
  },
  {
    name: 'HTTP 404 Not Found',
    response: {
      status: 404,
      headers: new Headers(),
      body: { message: 'Not Found' },
    },
    now: NOW,
    expected: null,
  },
  {
    name: 'HTTP 500 without a body',
    response: {
      status: 500,
      headers: new Headers(),
      body: undefined,
    },
    now: NOW,
    expected: null,
  },
  {
    name: 'HTTP 401 Bad credentials',
    response: {
      status: 401,
      headers: new Headers(),
      body: { message: 'Bad credentials' },
    },
    now: NOW,
    expected: null,
  },
  {
    name: 'GraphQL NOT_FOUND error with HTTP 200',
    response: {
      status: 200,
      headers: new Headers(),
      body: {
        errors: [{ type: 'NOT_FOUND', message: 'Could not resolve' }],
      },
    },
    now: NOW,
    expected: null,
  },
  {
    name: 'HTTP 200 with an empty object body',
    response: {
      status: 200,
      headers: new Headers(),
      body: {},
    },
    now: NOW,
    expected: null,
  },
];

describe('githubRateLimitSignalOf', () => {
  it('returns the reset time for each GitHub rate limit response and null for every other response', () => {
    expect(
      cases.map((testCase) => ({
        name: testCase.name,
        signal: githubRateLimitSignalOf(testCase.response, testCase.now),
      })),
    ).toEqual(
      cases.map((testCase) => ({
        name: testCase.name,
        signal: testCase.expected,
      })),
    );
  });
});
