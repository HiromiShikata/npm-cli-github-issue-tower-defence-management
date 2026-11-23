import {
  LiveSessionCreateResult,
  LiveSessionRepository,
} from '../../domain/usecases/adapter-interfaces/LiveSessionRepository';
import {
  VOICE_CONSOLE_INSTRUCTIONS,
  VOICE_CONSOLE_TOOL_DEFINITIONS,
} from '../voice-console/voiceConsoleLiveSessionConfig';

const OPENAI_LIVE_SESSIONS_URL = 'https://api.openai.com/v1/live/sessions';

const buildLiveSessionRequestBody = (sdpOffer: string): string =>
  JSON.stringify({
    session: {
      model: 'gpt-live-1',
      instructions: VOICE_CONSOLE_INSTRUCTIONS,
      audio: { output: { voice: 'harema' } },
      delegation: {
        type: 'responses',
        responses: {
          model: 'gpt-6.2-astra',
          tools: VOICE_CONSOLE_TOOL_DEFINITIONS,
        },
      },
    },
    transport: { type: 'webrtc', sdp: sdpOffer },
  });

const readErrorMessage = (body: string): string => {
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof parsed.error === 'object' &&
      parsed.error !== null &&
      'message' in parsed.error &&
      typeof parsed.error.message === 'string'
    ) {
      return parsed.error.message;
    }
  } catch {
    return body;
  }
  return body;
};

type LiveSessionResponseFields = {
  sessionId: string | null;
  sdpAnswer: string | null;
};

const readLiveSessionResponseFields = (
  body: string,
): LiveSessionResponseFields => {
  const fields: LiveSessionResponseFields = {
    sessionId: null,
    sdpAnswer: null,
  };
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null) {
      return fields;
    }
    if (
      'session' in parsed &&
      typeof parsed.session === 'object' &&
      parsed.session !== null &&
      'id' in parsed.session &&
      typeof parsed.session.id === 'string'
    ) {
      fields.sessionId = parsed.session.id;
    }
    if (
      'transport' in parsed &&
      typeof parsed.transport === 'object' &&
      parsed.transport !== null &&
      'sdp' in parsed.transport &&
      typeof parsed.transport.sdp === 'string'
    ) {
      fields.sdpAnswer = parsed.transport.sdp;
    }
  } catch {
    return fields;
  }
  return fields;
};

export class OpenAiLiveSessionRepository implements LiveSessionRepository {
  constructor(
    private readonly fetchImplementation: typeof fetch = fetch,
    private readonly readApiKey: () => string | undefined = () =>
      process.env.OPENAI_API_KEY,
    private readonly logError: (message: string) => void = (message) =>
      console.error(message),
  ) {}

  async createFromSdpOffer(sdpOffer: string): Promise<LiveSessionCreateResult> {
    const apiKey = this.readApiKey();
    if (apiKey === undefined || apiKey === '') {
      return { type: 'apiKeyMissing' };
    }

    let response: Response;
    let body: string;
    try {
      response = await this.fetchImplementation(OPENAI_LIVE_SESSIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: buildLiveSessionRequestBody(sdpOffer),
      });
      body = await response.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logError(
        `OpenAI live session request failed with status 502 before a response: ${message}`,
      );
      return { type: 'openAiFailed', status: 502, message };
    }

    if (!response.ok) {
      const message = readErrorMessage(body);
      this.logError(
        `OpenAI live session creation failed with status ${response.status}: ${message}`,
      );
      return { type: 'openAiFailed', status: response.status, message };
    }

    const fields = readLiveSessionResponseFields(body);
    if (fields.sessionId === null) {
      const message = 'OpenAI live session response has no session.id';
      this.logError(`${message}; reported with status 502`);
      return { type: 'openAiFailed', status: 502, message };
    }
    if (fields.sdpAnswer === null) {
      const message = 'OpenAI live session response has no transport.sdp';
      this.logError(`${message}; reported with status 502`);
      return { type: 'openAiFailed', status: 502, message };
    }
    return {
      type: 'created',
      sdpAnswer: fields.sdpAnswer,
      sessionId: fields.sessionId,
    };
  }
}
