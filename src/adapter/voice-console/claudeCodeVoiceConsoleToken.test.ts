import type {
  LiveSessionOauthTokenSelectHandlerInput,
  LiveSessionOauthTokenSelectHandlerOutput,
} from '../entry-points/handlers/LiveSessionOauthTokenSelectHandler';
import { selectClaudeCodeVoiceConsoleOauthToken } from './claudeCodeVoiceConsoleToken';

const SELECTION_SETTINGS = {
  maxConcurrentSessionCount: 3,
  fullSpeedFiveHourFreeRatio: 0.5,
  minFiveHourFreeRatio: 0.1,
  minSevenDayFreeRatio: 0.1,
  fiveHourShareConsumedPerSessionHour: 0.2,
  sevenDayShareConsumedPerSessionHour: 0.02,
};

const createFakeHandler = (
  output: LiveSessionOauthTokenSelectHandlerOutput,
) => {
  const handle = jest.fn(
    (
      _input: LiveSessionOauthTokenSelectHandlerInput,
    ): LiveSessionOauthTokenSelectHandlerOutput => output,
  );
  return { handler: { handle }, handle };
};

const INPUT_CASES: {
  name: string;
  input: LiveSessionOauthTokenSelectHandlerInput;
}[] = [
  {
    name: 'token list path and cache directory given',
    input: {
      tokenListJsonPath: '/etc/tdpm/tokens.json',
      cacheDirectory: '/var/cache/tdpm',
      nowEpochSeconds: 1_800_000_000,
      selectionSettings: SELECTION_SETTINGS,
    },
  },
  {
    name: 'both unset',
    input: {
      tokenListJsonPath: null,
      cacheDirectory: null,
      nowEpochSeconds: 1_800_000_000,
      selectionSettings: SELECTION_SETTINGS,
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
    const cases: {
      name: string;
      output: LiveSessionOauthTokenSelectHandlerOutput;
    }[] = [
      {
        name: 'the token list is empty',
        output: {
          selectedToken: null,
          selectedName: null,
          diagnostics: ['token list has no entries'],
        },
      },
      {
        name: 'every token is rate limited',
        output: {
          selectedToken: null,
          selectedName: null,
          diagnostics: ['account-a: limited', 'account-b: limited'],
        },
      },
      {
        name: 'a token without a name is not usable',
        output: {
          selectedToken: 'token-a',
          selectedName: null,
          diagnostics: ['account name missing'],
        },
      },
    ];

    for (const testCase of cases) {
      const { handler } = createFakeHandler(testCase.output);

      const result = selectClaudeCodeVoiceConsoleOauthToken(
        INPUT_CASES[0].input,
        handler,
      );

      expect({
        name: testCase.name,
        diagnostics: 'error' in result ? result.diagnostics : null,
        hasToken: 'token' in result,
        errorIsText: 'error' in result && result.error.length > 0,
      }).toEqual({
        name: testCase.name,
        diagnostics: testCase.output.diagnostics,
        hasToken: false,
        errorIsText: true,
      });
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
