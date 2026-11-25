import {
  splitCommentaryContent,
  VoiceConsoleDelegationBridge,
} from './voiceConsoleDelegationBridge';

const JAPANESE_CHARACTER = /[぀-ヿ一-鿿]/;

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const createDeferred = <T>() => {
  const resolvers: ((value: T) => void)[] = [];
  const promise = new Promise<T>((resolve) => {
    resolvers.push(resolve);
  });
  return {
    promise,
    resolve: (value: T): void => {
      for (const resolver of resolvers) resolver(value);
    },
  };
};

const createBridge = (
  sendToBackend: (utterance: string) => Promise<string> = () =>
    Promise.resolve('backend answer'),
) => {
  const appendCommentary = jest.fn(
    (_delegationId: string, _content: string): void => undefined,
  );
  const recordCommentarySent = jest.fn((_content: string): void => undefined);
  const logError = jest.fn((_message: string): void => undefined);
  const newEventId = jest.fn((): string => 'event-1');
  const sendToBackendMock = jest.fn(sendToBackend);
  const bridge = new VoiceConsoleDelegationBridge({
    sendToBackend: sendToBackendMock,
    appendCommentary,
    newEventId,
    logError,
    recordCommentarySent,
  });
  return {
    bridge,
    sendToBackend: sendToBackendMock,
    appendCommentary,
    recordCommentarySent,
    logError,
  };
};

describe('splitCommentaryContent', () => {
  it('splits text into chunks of at most maxCharacters code points that rejoin to the input', () => {
    const cases: {
      name: string;
      text: string;
      maxCharacters: number;
      expected: string[];
    }[] = [
      {
        name: 'empty text gives no chunks',
        text: '',
        maxCharacters: 3,
        expected: [],
      },
      {
        name: 'text shorter than the limit is one chunk',
        text: 'abc',
        maxCharacters: 3,
        expected: ['abc'],
      },
      {
        name: 'text exactly at the limit is one chunk',
        text: 'abc',
        maxCharacters: 3,
        expected: ['abc'],
      },
      {
        name: 'text one over the limit gives a second chunk',
        text: 'abcd',
        maxCharacters: 3,
        expected: ['abc', 'd'],
      },
      {
        name: 'Japanese text is counted by characters',
        text: '日本語テキスト',
        maxCharacters: 3,
        expected: ['日本語', 'テキス', 'ト'],
      },
      {
        name: 'a surrogate pair is never split',
        text: '😀😀😀',
        maxCharacters: 2,
        expected: ['😀😀', '😀'],
      },
    ];

    for (const testCase of cases) {
      const chunks = splitCommentaryContent(
        testCase.text,
        testCase.maxCharacters,
      );

      expect({ name: testCase.name, chunks }).toEqual({
        name: testCase.name,
        chunks: testCase.expected,
      });
      expect({
        name: testCase.name,
        joined: chunks.join(''),
      }).toEqual({ name: testCase.name, joined: testCase.text });
    }
  });
});

describe('VoiceConsoleDelegationBridge delegation', () => {
  it('sends the owner utterance accumulated since the previous delegation once, then resets it', async () => {
    const { bridge, sendToBackend } = createBridge();

    bridge.handleOwnerTranscriptDelta('今日の');
    bridge.handleOwnerTranscriptDelta('タスクは');
    bridge.handleDelegationCreated('delegation_1');
    await flush();
    bridge.handleOwnerTranscriptDelta('次は');
    bridge.handleDelegationCreated('delegation_2');
    await flush();

    expect(sendToBackend.mock.calls).toEqual([['今日のタスクは'], ['次は']]);
  });

  it('appends each chunk of the backend answer with the delegation id, in order', async () => {
    const answer = `${'a'.repeat(300)}${'b'.repeat(300)}${'c'.repeat(50)}`;
    const { bridge, appendCommentary, recordCommentarySent } = createBridge(
      () => Promise.resolve(answer),
    );

    bridge.handleOwnerTranscriptDelta('質問');
    bridge.handleDelegationCreated('delegation_9');
    await flush();

    const expectedChunks = ['a'.repeat(300), 'b'.repeat(300), 'c'.repeat(50)];
    expect({
      appended: appendCommentary.mock.calls,
      recorded: recordCommentarySent.mock.calls.map((call) => call[0]),
    }).toEqual({
      appended: expectedChunks.map((chunk) => ['delegation_9', chunk]),
      recorded: expectedChunks,
    });
  });

  it('records each chunk exactly as it was appended to the session', async () => {
    const { bridge, appendCommentary, recordCommentarySent } = createBridge(
      () => Promise.resolve('短い回答です'),
    );

    bridge.handleDelegationCreated('delegation_3');
    await flush();

    expect({
      appended: appendCommentary.mock.calls.map((call) => call[1]),
      recorded: recordCommentarySent.mock.calls.map((call) => call[0]),
    }).toEqual({ appended: ['短い回答です'], recorded: ['短い回答です'] });
  });

  it('speaks a Japanese failure sentence and logs the diagnostic when the backend fails', async () => {
    const cases: {
      name: string;
      reason: Error;
      expectedLogFragment: string;
    }[] = [
      {
        name: 'an Error',
        reason: new Error('boom-error'),
        expectedLogFragment: 'boom-error',
      },
    ];

    for (const testCase of cases) {
      const { bridge, appendCommentary, recordCommentarySent, logError } =
        createBridge(() => Promise.reject(testCase.reason));

      bridge.handleDelegationCreated('delegation_4');
      await flush();

      const appended = appendCommentary.mock.calls;
      expect({
        name: testCase.name,
        appendedCount: appended.length,
        delegationId: appended[0]?.[0],
        spokenIsJapanese: JAPANESE_CHARACTER.test(appended[0]?.[1] ?? ''),
        recordedSameAsAppended:
          recordCommentarySent.mock.calls[0]?.[0] === appended[0]?.[1],
        loggedDiagnostic: logError.mock.calls
          .map((call) => call[0])
          .join('\n')
          .includes(testCase.expectedLogFragment),
      }).toEqual({
        name: testCase.name,
        appendedCount: 1,
        delegationId: 'delegation_4',
        spokenIsJapanese: true,
        recordedSameAsAppended: true,
        loggedDiagnostic: true,
      });
    }
  });

  it('keeps handling the next delegation normally after a failed one', async () => {
    const { bridge, sendToBackend, appendCommentary } = createBridge();
    sendToBackend
      .mockRejectedValueOnce(new Error('first failed'))
      .mockResolvedValueOnce('second answer');

    bridge.handleDelegationCreated('delegation_5');
    await flush();
    bridge.handleDelegationCreated('delegation_6');
    await flush();

    expect(appendCommentary.mock.calls.map((call) => call[0])).toEqual([
      'delegation_5',
      'delegation_6',
    ]);
    expect(appendCommentary.mock.calls[1]?.[1]).toBe('second answer');
  });

  it('serializes turns: the second delegation waits until the first turn has completed', async () => {
    const first = createDeferred<string>();
    const { bridge, sendToBackend, appendCommentary } = createBridge(
      (utterance: string) =>
        utterance === '一つ目'
          ? first.promise
          : Promise.resolve('二つ目の回答'),
    );

    bridge.handleOwnerTranscriptDelta('一つ目');
    bridge.handleDelegationCreated('delegation_7');
    bridge.handleOwnerTranscriptDelta('二つ目');
    bridge.handleDelegationCreated('delegation_8');
    await flush();
    expect(sendToBackend.mock.calls).toEqual([['一つ目']]);

    first.resolve('一つ目の回答');
    await flush();

    expect(sendToBackend.mock.calls).toEqual([['一つ目'], ['二つ目']]);
    expect(appendCommentary.mock.calls).toEqual([
      ['delegation_7', '一つ目の回答'],
      ['delegation_8', '二つ目の回答'],
    ]);
  });
});
