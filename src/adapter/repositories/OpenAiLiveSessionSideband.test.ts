import {
  OpenAiLiveSessionSideband,
  type VoiceConsoleSocket,
} from './OpenAiLiveSessionSideband';

type SocketEventType = 'message' | 'close' | 'error';
type SocketListener = (event: { data?: unknown }) => void;

class FakeSocket implements VoiceConsoleSocket {
  readonly sent: string[] = [];
  private readonly listeners = new Map<SocketEventType, SocketListener[]>();

  send(data: string): void {
    this.sent.push(data);
  }

  addEventListener(type: SocketEventType, listener: SocketListener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: SocketEventType, event: { data?: unknown }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

const flushPromises = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const createRecordingHandler = () =>
  jest.fn(
    (
      _event: unknown,
      _send: (event: Record<string, unknown>) => void,
    ): Promise<void> => Promise.resolve(),
  );

const createHarness = (apiKey: string | undefined = 'key-1') => {
  const socket = new FakeSocket();
  const createSocket = jest.fn(
    (_url: string, _headers: Record<string, string>): VoiceConsoleSocket =>
      socket,
  );
  const logError = jest.fn();
  const sideband = new OpenAiLiveSessionSideband(
    createSocket,
    () => apiKey,
    logError,
  );
  return { socket, createSocket, logError, sideband };
};

describe('OpenAiLiveSessionSideband.attachUrl', () => {
  it('builds the attach URL for each session id', () => {
    const cases = [
      {
        sessionId: 'live_123',
        expected: 'wss://api.openai.com/v1/live/sessions/live_123/attach',
      },
      {
        sessionId: 'abc-DEF_9',
        expected: 'wss://api.openai.com/v1/live/sessions/abc-DEF_9/attach',
      },
    ];

    for (const testCase of cases) {
      expect(OpenAiLiveSessionSideband.attachUrl(testCase.sessionId)).toBe(
        testCase.expected,
      );
    }
  });
});

describe('OpenAiLiveSessionSideband.attach', () => {
  it('throws and opens no socket for a session id with characters outside the allowed set', () => {
    const cases = [
      { sessionId: 'a/b' },
      { sessionId: 'a b' },
      { sessionId: 'live.1' },
      { sessionId: 'x?y' },
      { sessionId: '../live_1' },
    ];

    for (const testCase of cases) {
      const { createSocket, sideband } = createHarness();

      expect(() =>
        sideband.attach(testCase.sessionId, () => Promise.resolve()),
      ).toThrow(Error);
      expect(createSocket).not.toHaveBeenCalled();
    }
  });

  it('throws and opens no socket when the API key is missing or empty', () => {
    const cases = [{ apiKey: undefined }, { apiKey: '' }];

    for (const testCase of cases) {
      const { createSocket, sideband } = createHarness(testCase.apiKey);

      expect(() =>
        sideband.attach('live_123', () => Promise.resolve()),
      ).toThrow(Error);
      expect(createSocket).not.toHaveBeenCalled();
    }
  });

  it('opens one socket to the attach URL with the bearer key header', () => {
    const { createSocket, sideband } = createHarness('key-1');

    sideband.attach('live_123', () => Promise.resolve());

    expect(createSocket).toHaveBeenCalledTimes(1);
    expect(createSocket).toHaveBeenCalledWith(
      'wss://api.openai.com/v1/live/sessions/live_123/attach',
      { Authorization: 'Bearer key-1' },
    );
  });

  it('parses each message and passes it with a send function that writes JSON to the socket', () => {
    const { socket, sideband } = createHarness();
    const handleServerEvent = createRecordingHandler();
    sideband.attach('live_123', handleServerEvent);

    const serverEvent = {
      type: 'response.event',
      event_id: 'e1',
      delegation_id: 'delegation_1',
      event: { type: 'response.created', response: { id: 'resp_1' } },
    };
    socket.emit('message', { data: JSON.stringify(serverEvent) });

    expect(handleServerEvent).toHaveBeenCalledTimes(1);
    const [receivedEvent, send] = handleServerEvent.mock.calls[0];
    expect(receivedEvent).toEqual(serverEvent);

    send({ type: 'response.create', event_id: 'voice_continue_resp_1' });
    expect(socket.sent).toEqual([
      JSON.stringify({
        type: 'response.create',
        event_id: 'voice_continue_resp_1',
      }),
    ]);
  });

  it('logs a malformed message without throwing and does not pass it on', () => {
    const { socket, logError, sideband } = createHarness();
    const handleServerEvent = createRecordingHandler();
    sideband.attach('live_123', handleServerEvent);

    expect(() => socket.emit('message', { data: '{not json' })).not.toThrow();
    expect(handleServerEvent).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it('logs close and error events', () => {
    const cases = [{ type: 'close' as const }, { type: 'error' as const }];

    for (const testCase of cases) {
      const { socket, logError, sideband } = createHarness();
      sideband.attach('live_123', () => Promise.resolve());

      socket.emit(testCase.type, {});

      expect({
        type: testCase.type,
        calls: logError.mock.calls.length,
      }).toEqual({ type: testCase.type, calls: 1 });
    }
  });

  it('logs a failure of the server event handler instead of dropping it', async () => {
    const { socket, logError, sideband } = createHarness();
    sideband.attach('live_123', () =>
      Promise.reject(new Error('handler boom')),
    );

    socket.emit('message', { data: JSON.stringify({ type: 'x' }) });
    await flushPromises();

    expect(logError.mock.calls.flat().join('\n')).toContain('handler boom');
  });
});
