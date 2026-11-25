import type {
  OauthTokenSelectHandlerInput,
  OauthTokenSelectHandlerOutput,
} from '../entry-points/handlers/OauthTokenSelectHandler';
import { selectClaudeCodeVoiceConsoleOauthToken } from './claudeCodeVoiceConsoleToken';

const createFakeHandler = (output: OauthTokenSelectHandlerOutput) => {
  const handle = jest.fn(
    (_input: OauthTokenSelectHandlerInput): OauthTokenSelectHandlerOutput =>
      output,
  );
  return { handler: { handle }, handle };
};

const INPUT_CASES: {
  name: string;
  input: OauthTokenSelectHandlerInput;
}[] = [
  {
    name: 'token list path and cache directory given',
    input: {
      tokenListJsonPath: '/etc/tdpm/tokens.json',
      cacheDirectory: '/var/cache/tdpm',
      nowEpochSeconds: 1_800_000_000,
    },
  },
  {
    name: 'both unset',
    input: {
      tokenListJsonPath: null,
      cacheDirectory: null,
      nowEpochSeconds: 1_800_000_000,
    },
  },
];

describe('selectClaudeCodeVoiceConsoleOauthToken', () => {
  it('returns the selected token and its name', () => {
    const cases = [
      {
        name: 'a token is selected',
        output: {
          selectedToken: 'token-a',
          selectedName: 'account-a',
          diagnostics: ['selected account-a'],
        },
        expected: { token: 'token-a', tokenName: 'account-a' },
      },
      {
        name: 'a different eligible token is selected',
        output: {
          selectedToken: 'token-b',
          selectedName: 'account-b',
          diagnostics: [],
        },
        expected: { token: 'token-b', tokenName: 'account-b' },
      },
    ];

    for (const testCase of cases) {
      const { handler } = createFakeHandler(testCase.output);

      expect({
        name: testCase.name,
        result: selectClaudeCodeVoiceConsoleOauthToken(
          INPUT_CASES[0].input,
          handler,
        ),
      }).toEqual({ name: testCase.name, result: testCase.expected });
    }
  });

  it('returns an error with the diagnostics when no token is eligible', () => {
    const cases = [
      {
        name: 'the token list is empty',
        diagnostics: ['token list has no entries'],
      },
      {
        name: 'every token is rate limited',
        diagnostics: ['account-a: limited', 'account-b: limited'],
      },
    ];

    for (const testCase of cases) {
      const { handler } = createFakeHandler({
        selectedToken: null,
        selectedName: null,
        diagnostics: testCase.diagnostics,
      });

      const result = selectClaudeCodeVoiceConsoleOauthToken(
        INPUT_CASES[0].input,
        handler,
      );

      expect({
        name: testCase.name,
        diagnostics: 'error' in result ? result.diagnostics : null,
        hasToken: 'token' in result,
      }).toEqual({
        name: testCase.name,
        diagnostics: testCase.diagnostics,
        hasToken: false,
      });
      expect('error' in result && result.error.length > 0).toBe(true);
    }
  });

  it('passes the same input through to the selection handler', () => {
    for (const testCase of INPUT_CASES) {
      const { handler, handle } = createFakeHandler({
        selectedToken: 'token-a',
        selectedName: 'account-a',
        diagnostics: [],
      });

      selectClaudeCodeVoiceConsoleOauthToken(testCase.input, handler);

      expect({ name: testCase.name, calls: handle.mock.calls }).toEqual({
        name: testCase.name,
        calls: [[testCase.input]],
      });
    }
  });
});
