import {
  LiveSessionCreateResult,
  LiveSessionRepository,
} from '../../domain/usecases/adapter-interfaces/LiveSessionRepository';

const OPENAI_LIVE_SESSIONS_URL = 'https://api.openai.com/v1/live/sessions';

const LIVE_SESSION_INSTRUCTIONS =
  'あなたはオーナーの音声アシスタントです。オーナーは複数の作業セッションからの呼び出しに、順番に声で答えています。アプリが呼び出しの本文を読み上げた後、あなたはオーナーと日本語で短く会話し、そのセッションに送る返事を決める手助けをします。オーナーが送る文を述べたら、その文を一字一句そのまま復唱し、オーナーが「送って」と言ったら、その文をそのまま session_reply_send で送ります。送る文を自分で作ったり言い換えたりしてはいけません。オーナーが「次」と言ったら session_skip を、「もう一度」と言ったら owner_call_repeat を呼びます。';

const NO_PARAMETERS_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

const LIVE_SESSION_TOOLS = [
  {
    type: 'function',
    name: 'session_reply_send',
    parameters: {
      type: 'object',
      properties: { replyText: { type: 'string' } },
      required: ['replyText'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'session_skip',
    parameters: NO_PARAMETERS_SCHEMA,
  },
  {
    type: 'function',
    name: 'owner_call_repeat',
    parameters: NO_PARAMETERS_SCHEMA,
  },
];

const buildLiveSessionRequestBody = (sdpOffer: string): string =>
  JSON.stringify({
    model: 'gpt-live-1',
    instructions: LIVE_SESSION_INSTRUCTIONS,
    audio: { output: { voice: 'harema' } },
    delegation: {
      type: 'responses',
      responses: {
        model: 'gpt-6-luna',
        tools: LIVE_SESSION_TOOLS,
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

const readSdpAnswer = (body: string): string | null => {
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'transport' in parsed &&
      typeof parsed.transport === 'object' &&
      parsed.transport !== null &&
      'sdp' in parsed.transport &&
      typeof parsed.transport.sdp === 'string'
    ) {
      return parsed.transport.sdp;
    }
  } catch {
    return null;
  }
  return null;
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

    const sdpAnswer = readSdpAnswer(body);
    if (sdpAnswer === null) {
      const message = 'OpenAI live session response has no transport.sdp';
      this.logError(`${message}; reported with status 502`);
      return { type: 'openAiFailed', status: 502, message };
    }
    return { type: 'created', sdpAnswer };
  }
}
