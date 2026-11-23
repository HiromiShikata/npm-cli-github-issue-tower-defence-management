import type { VoiceConsoleSendEvent } from '../voice-console/voiceConsoleSideband';

const OPENAI_LIVE_SESSIONS_ORIGIN = 'wss://api.openai.com/v1/live/sessions';
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const SIDEBAND_OPEN_TIMEOUT_MS = 10_000;
const SESSION_CLOSE_TIMEOUT_MS = 10_000;

export type VoiceConsoleSocketEventType =
  'open' | 'message' | 'close' | 'error';

export type VoiceConsoleSocketListener = (event: { data?: unknown }) => void;

export type VoiceConsoleSocket = {
  send(data: string): void;
  close(): void;
  addEventListener(
    type: VoiceConsoleSocketEventType,
    listener: VoiceConsoleSocketListener,
  ): void;
};

export type VoiceConsoleSocketFactory = (
  url: string,
  headers: Record<string, string>,
) => VoiceConsoleSocket;

export type VoiceConsoleServerEventHandler = (
  event: unknown,
  send: VoiceConsoleSendEvent,
) => Promise<void>;

// The global WebSocket of Node accepts a headers option that the standard
// lib type does not declare, so the constructor is checked at runtime here.
type WebSocketWithHeadersConstructor = new (
  url: string,
  options: { headers: Record<string, string> },
) => VoiceConsoleSocket;

const isWebSocketWithHeadersConstructor = (
  value: unknown,
): value is WebSocketWithHeadersConstructor => typeof value === 'function';

const createOpenAiVoiceConsoleSocket: VoiceConsoleSocketFactory = (
  url,
  headers,
) => {
  const constructorValue: unknown = globalThis.WebSocket;
  if (!isWebSocketWithHeadersConstructor(constructorValue)) {
    throw new Error('global WebSocket is not available in this runtime');
  }
  return new constructorValue(url, { headers });
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isSessionClosedEvent = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  value.type === 'session.closed';

export class OpenAiLiveSessionSideband {
  constructor(
    private readonly createSocket: VoiceConsoleSocketFactory = createOpenAiVoiceConsoleSocket,
    private readonly readApiKey: () => string | undefined = () =>
      process.env.OPENAI_API_KEY,
    private readonly logError: (message: string) => void = (message) =>
      console.error(message),
  ) {}

  static attachUrl(sessionId: string): string {
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      throw new Error(
        'OpenAI live session id has characters outside [A-Za-z0-9_-]',
      );
    }
    return `${OPENAI_LIVE_SESSIONS_ORIGIN}/${sessionId}/attach`;
  }

  attach(
    sessionId: string,
    handleServerEvent: VoiceConsoleServerEventHandler,
  ): Promise<void> {
    const url = OpenAiLiveSessionSideband.attachUrl(sessionId);
    const apiKey = this.readApiKey();
    if (apiKey === undefined || apiKey === '') {
      throw new Error(
        'OPENAI_API_KEY is not set for the live session sideband',
      );
    }
    return new Promise<void>((resolve, reject) => {
      const socket = this.createSocket(url, {
        Authorization: `Bearer ${apiKey}`,
      });
      const send: VoiceConsoleSendEvent = (event) => {
        socket.send(JSON.stringify(event));
      };
      const openTimer = setTimeout(() => {
        const message = `OpenAI live session ${sessionId} sideband did not open within ${SIDEBAND_OPEN_TIMEOUT_MS} ms`;
        this.logError(message);
        socket.close();
        reject(new Error(message));
      }, SIDEBAND_OPEN_TIMEOUT_MS);
      openTimer.unref();

      socket.addEventListener('open', () => {
        clearTimeout(openTimer);
        resolve();
      });
      socket.addEventListener('message', (event) => {
        if (typeof event.data !== 'string') {
          this.logError(
            `OpenAI live session ${sessionId} received a non-text message`,
          );
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch (error) {
          this.logError(
            `OpenAI live session ${sessionId} received a malformed message: ${describeError(error)}`,
          );
          return;
        }
        handleServerEvent(parsed, send).catch((error: unknown) => {
          this.logError(
            `OpenAI live session ${sessionId} event handling failed: ${describeError(error)}`,
          );
        });
      });
      socket.addEventListener('close', () => {
        clearTimeout(openTimer);
        this.logError(`OpenAI live session ${sessionId} sideband closed`);
        reject(
          new Error(
            `OpenAI live session ${sessionId} sideband closed before it opened`,
          ),
        );
      });
      socket.addEventListener('error', () => {
        clearTimeout(openTimer);
        this.logError(`OpenAI live session ${sessionId} sideband error`);
        reject(
          new Error(
            `OpenAI live session ${sessionId} sideband error before it opened`,
          ),
        );
      });
    });
  }

  async close(sessionId: string): Promise<void> {
    const url = OpenAiLiveSessionSideband.attachUrl(sessionId);
    const apiKey = this.readApiKey();
    if (apiKey === undefined || apiKey === '') {
      throw new Error(
        'OPENAI_API_KEY is not set for the live session sideband',
      );
    }
    return new Promise<void>((resolve, reject) => {
      const socket = this.createSocket(url, {
        Authorization: `Bearer ${apiKey}`,
      });
      const closeTimer = setTimeout(() => {
        socket.close();
        reject(
          new Error(
            `OpenAI live session ${sessionId} did not confirm session.closed within ${SESSION_CLOSE_TIMEOUT_MS} ms`,
          ),
        );
      }, SESSION_CLOSE_TIMEOUT_MS);
      closeTimer.unref();
      const failBeforeClosed = (message: string): void => {
        clearTimeout(closeTimer);
        socket.close();
        reject(new Error(message));
      };

      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ type: 'session.close' }));
      });
      socket.addEventListener('message', (event) => {
        if (typeof event.data !== 'string') {
          this.logError(
            `OpenAI live session ${sessionId} received a non-text message while closing`,
          );
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch (error) {
          this.logError(
            `OpenAI live session ${sessionId} received a malformed message while closing: ${describeError(error)}`,
          );
          return;
        }
        if (isSessionClosedEvent(parsed)) {
          clearTimeout(closeTimer);
          socket.close();
          resolve();
        }
      });
      socket.addEventListener('close', () => {
        failBeforeClosed(
          `OpenAI live session ${sessionId} sideband closed before session.closed`,
        );
      });
      socket.addEventListener('error', () => {
        failBeforeClosed(
          `OpenAI live session ${sessionId} sideband error before session.closed`,
        );
      });
    });
  }
}
