import type { VoiceConsoleSendEvent } from '../voice-console/voiceConsoleSideband';

const OPENAI_LIVE_SESSIONS_ORIGIN = 'wss://api.openai.com/v1/live/sessions';
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export type VoiceConsoleSocketEventType = 'message' | 'close' | 'error';

export type VoiceConsoleSocketListener = (event: { data?: unknown }) => void;

export type VoiceConsoleSocket = {
  send(data: string): void;
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
  ): void {
    const url = OpenAiLiveSessionSideband.attachUrl(sessionId);
    const apiKey = this.readApiKey();
    if (apiKey === undefined || apiKey === '') {
      throw new Error(
        'OPENAI_API_KEY is not set for the live session sideband',
      );
    }
    const socket = this.createSocket(url, {
      Authorization: `Bearer ${apiKey}`,
    });
    const send: VoiceConsoleSendEvent = (event) => {
      socket.send(JSON.stringify(event));
    };

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
      this.logError(`OpenAI live session ${sessionId} sideband closed`);
    });
    socket.addEventListener('error', () => {
      this.logError(`OpenAI live session ${sessionId} sideband error`);
    });
  }
}
