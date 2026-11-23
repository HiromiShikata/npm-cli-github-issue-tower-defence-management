import {
  OpenAiLiveSessionSideband,
  type VoiceConsoleSocket,
} from './OpenAiLiveSessionSideband';

type SocketEventType = 'open' | 'message' | 'close' | 'error';
type SocketListener = (event: { data?: unknown }) => void;

class FakeSocket implements VoiceConsoleSocket {
  readonly sent: string[] = [];
  closed = false;

  close(): void {
    this.closed = true;
  }
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

const createHarness = (
  options: { readApiKey?: () => string | undefined; opens?: boolean } = {},
) => {
  const socket = new FakeSocket();
  const createSocket = jest.fn(
    (_url: string, _headers: Record<string, string>): VoiceConsoleSocket =>
      socket,
  );
  const logError = jest.fn();
  if (options.opens !== false) {
    queueMicrotask(() => {
      socket.emit('open', {});
    });
  }
  const readApiKey = options.readApiKey ?? (() => 'key-1');
  const sideband = new OpenAiLiveSessionSideband(
    createSocket,
    readApiKey,
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
    const cases = [
      {
        name: 'undefined key',
        readApiKey: (): string | undefined => undefined,
      },
      { name: 'empty key', readApiKey: (): string | undefined => '' },
    ];

    for (const testCase of cases) {
      const { createSocket, sideband } = createHarness({
        readApiKey: testCase.readApiKey,
      });

      expect(() =>
        sideband.attach('live_123', () => Promise.resolve()),
      ).toThrow(Error);
      expect(createSocket).not.toHaveBeenCalled();
    }
  });

  it('opens one socket to the attach URL with the bearer key header', () => {
    const { createSocket, sideband } = createHarness();

    void sideband.attach('live_123', () => Promise.resolve());

    expect(createSocket).toHaveBeenCalledTimes(1);
    expect(createSocket).toHaveBeenCalledWith(
      'wss://api.openai.com/v1/live/sessions/live_123/attach',
      { Authorization: 'Bearer key-1' },
    );
  });

  it('parses each message and passes it with a send function that writes JSON to the socket', () => {
    const { socket, sideband } = createHarness();
    const handleServerEvent = createRecordingHandler();
    void sideband.attach('live_123', handleServerEvent);

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
    void sideband.attach('live_123', handleServerEvent);

    expect(() => socket.emit('message', { data: '{not json' })).not.toThrow();
    expect(handleServerEvent).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it('logs close and error events after the socket has opened', async () => {
    const cases = [{ type: 'close' as const }, { type: 'error' as const }];

    for (const testCase of cases) {
      const { socket, logError, sideband } = createHarness();
      const attached = sideband.attach('live_123', () => Promise.resolve());
      socket.emit('open', {});
      await attached;

      socket.emit(testCase.type, {});

      expect({
        type: testCase.type,
        calls: logError.mock.calls.length,
      }).toEqual({ type: testCase.type, calls: 1 });
    }
  });

  it('logs a failure of the server event handler instead of dropping it', async () => {
    const { socket, logError, sideband } = createHarness();
    void sideband.attach('live_123', () =>
      Promise.reject(new Error('handler boom')),
    );

    socket.emit('message', { data: JSON.stringify({ type: 'x' }) });
    await flushPromises();

    expect(logError.mock.calls.flat().join('\n')).toContain('handler boom');
  });

  it('resolves the attach once the socket opens and rejects when it fails before opening', async () => {
    const cases = [
      { name: 'opens', event: 'open' as const, expectedResult: 'resolved' },
      {
        name: 'closes first',
        event: 'close' as const,
        expectedResult: 'rejected',
      },
      {
        name: 'errors first',
        event: 'error' as const,
        expectedResult: 'rejected',
      },
    ];

    for (const testCase of cases) {
      const { socket, sideband } = createHarness();
      const attached = sideband.attach('live_123', () => Promise.resolve());
      socket.emit(testCase.event, {});

      const outcome = await attached.then(
        () => 'resolved',
        () => 'rejected',
      );

      expect({ name: testCase.name, outcome }).toEqual({
        name: testCase.name,
        outcome: testCase.expectedResult,
      });
    }
  });

  it('rejects and closes the socket when it does not open within the timeout', async () => {
    jest.useFakeTimers();
    try {
      const { socket, sideband } = createHarness({ opens: false });
      const attached = sideband.attach('live_123', () => Promise.resolve());
      jest.advanceTimersByTime(10_000);

      await expect(attached).rejects.toThrow(
        'OpenAI live session live_123 sideband did not open within 10000 ms',
      );
      expect(socket.closed).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});


describe('OpenAiLiveSessionSideband.close', () => {
  const sessionClosedEvent = JSON.stringify({
    type: 'session.closed',
    event_id: 'event_1',
    reason: 'close_requested',
  });

  it('opens the attach socket with the bearer key, sends session.close and resolves on session.closed', async () => {
    const { socket, createSocket, sideband, logError } = createHarness();

    const closing = sideband.close('live_123');
    await flushPromises();

    expect(createSocket.mock.calls[0]).toEqual([
      'wss://api.openai.com/v1/live/sessions/live_123/attach',
      { Authorization: 'Bearer key-1' },
    ]);
    expect(socket.sent.map((data) => JSON.parse(data))).toEqual([
      { type: 'session.close' },
    ]);
    socket.emit('message', { data: sessionClosedEvent });

    await expect(closing).resolves.toBeUndefined();
    expect({ closed: socket.closed, logged: logError.mock.calls }).toEqual({
      closed: true,
      logged: [],
    });
  });

  it('ignores events other than session.closed while it waits', async () => {
    const { socket, sideband } = createHarness();

    const closing = sideband.close('live_123');
    await flushPromises();
    socket.emit('message', {
      data: JSON.stringify({ type: 'session.updated' }),
    });
    socket.emit('message', { data: sessionClosedEvent });

    await expect(closing).resolves.toBeUndefined();
  });

  it('rejects with the session id when the socket closes before session.closed', async () => {
    const { socket, sideband } = createHarness();

    const closing = sideband.close('live_123');
    await flushPromises();
    socket.emit('close', {});

    await expect(closing).rejects.toThrow(
      'OpenAI live session live_123 sideband closed before session.closed',
    );
  });

  it('rejects with the session id when the socket errors before session.closed', async () => {
    const { socket, sideband } = createHarness();

    const closing = sideband.close('live_123');
    await flushPromises();
    socket.emit('error', {});

    await expect(closing).rejects.toThrow(
      'OpenAI live session live_123 sideband error before session.closed',
    );
  });

  it('rejects and closes the socket when session.closed does not arrive within the timeout', async () => {
    jest.useFakeTimers();
    try {
      const { socket, sideband } = createHarness({ opens: false });

      const closing = sideband.close('live_123');
      socket.emit('open', {});
      jest.advanceTimersByTime(10_000);

      await expect(closing).rejects.toThrow(
        'OpenAI live session live_123 did not confirm session.closed within 10000 ms',
      );
      expect(socket.closed).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects and closes the socket when it does not open within the timeout', async () => {
    jest.useFakeTimers();
    try {
      const { socket, sideband } = createHarness({ opens: false });

      const closing = sideband.close('live_123');
      jest.advanceTimersByTime(10_000);

      await expect(closing).rejects.toThrow(
        'OpenAI live session live_123 did not confirm session.closed within 10000 ms',
      );
      expect(socket.closed).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects without opening a socket when the API key is missing or empty', async () => {
    for (const key of [undefined, '']) {
      const { createSocket, sideband } = createHarness({
        readApiKey: () => key,
      });

      await expect(sideband.close('live_123')).rejects.toThrow(
        'OPENAI_API_KEY is not set for the live session sideband',
      );
      expect(createSocket).not.toHaveBeenCalled();
    }
  });

  it('rejects without opening a socket for a session id outside the allowed set', async () => {
    const { createSocket, sideband } = createHarness();

    await expect(sideband.close('live/123')).rejects.toThrow(
      'OpenAI live session id has characters outside [A-Za-z0-9_-]',
    );
    expect(createSocket).not.toHaveBeenCalled();
  });
});
