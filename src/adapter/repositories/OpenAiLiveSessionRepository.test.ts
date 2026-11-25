import {
  buildLiveSessionRequestBody,
  OpenAiLiveSessionRepository,
} from './OpenAiLiveSessionRepository';
import { VOICE_CONSOLE_LIVE_INSTRUCTIONS } from '../voice-console/voiceConsoleLiveSessionConfig';

const responseWithJson = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('OpenAiLiveSessionRepository', () => {
  it('posts the configured live session request without logging the API key', async () => {
    const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
    fetchImplementation.mockResolvedValue(
      responseWithJson(201, {
        session: { id: 'live_123' },
        transport: { type: 'webrtc', sdp: 'ANSWER-SDP' },
      }),
    );
    const logError = jest.fn();
    const repository = new OpenAiLiveSessionRepository(
      fetchImplementation,
      () => 'secret-api-key',
      logError,
    );

    await repository.createFromSdpOffer('OFFER-SDP');

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [url, request] = fetchImplementation.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/live/sessions');
    expect(request?.method).toBe('POST');
    expect(request?.headers).toEqual({
      Authorization: 'Bearer secret-api-key',
      'Content-Type': 'application/json',
    });
    const requestBody = request?.body;
    if (typeof requestBody !== 'string') {
      throw new Error('request body was not serialized as JSON');
    }
    expect(JSON.parse(requestBody)).toEqual({
      session: {
        model: 'gpt-live-1',
        instructions: VOICE_CONSOLE_LIVE_INSTRUCTIONS,
        audio: { output: { voice: 'marin' } },
        delegation: { type: 'client' },
      },
      transport: { type: 'webrtc', sdp: 'OFFER-SDP' },
    });
    const parsedRequestBody: unknown = JSON.parse(requestBody);
    if (
      typeof parsedRequestBody !== 'object' ||
      parsedRequestBody === null ||
      Array.isArray(parsedRequestBody)
    ) {
      throw new Error('request body is not a JSON object');
    }
    expect(Object.keys(parsedRequestBody).sort()).toEqual([
      'session',
      'transport',
    ]);
    expect(parsedRequestBody).not.toHaveProperty('model');
    expect(logError.mock.calls.flat().join('\n')).not.toContain(
      'secret-api-key',
    );
  });

  it('returns apiKeyMissing without calling fetch for a missing key', async () => {
    const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
    const repository = new OpenAiLiveSessionRepository(
      fetchImplementation,
      () => undefined,
      jest.fn(),
    );

    await expect(repository.createFromSdpOffer('OFFER-SDP')).resolves.toEqual({
      type: 'apiKeyMissing',
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('returns apiKeyMissing without calling fetch for an empty key', async () => {
    const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
    const repository = new OpenAiLiveSessionRepository(
      fetchImplementation,
      () => '',
      jest.fn(),
    );

    await expect(repository.createFromSdpOffer('OFFER-SDP')).resolves.toEqual({
      type: 'apiKeyMissing',
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('returns the created answer from a successful response', async () => {
    const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
    fetchImplementation.mockResolvedValue(
      responseWithJson(201, {
        session: { id: 'live_123' },
        transport: { type: 'webrtc', sdp: 'ANSWER-SDP' },
      }),
    );
    const repository = new OpenAiLiveSessionRepository(
      fetchImplementation,
      () => 'secret-api-key',
      jest.fn(),
    );

    await expect(repository.createFromSdpOffer('OFFER-SDP')).resolves.toEqual({
      type: 'created',
      sdpAnswer: 'ANSWER-SDP',
      sessionId: 'live_123',
    });
  });

  it('logs and maps a successful response without a string session.id as a 502 failure', async () => {
    const cases = [
      {
        name: 'no session object',
        body: { transport: { type: 'webrtc', sdp: 'ANSWER-SDP' } },
      },
      {
        name: 'session without id',
        body: { session: {}, transport: { type: 'webrtc', sdp: 'ANSWER-SDP' } },
      },
      {
        name: 'non-string session id',
        body: {
          session: { id: 5 },
          transport: { type: 'webrtc', sdp: 'ANSWER-SDP' },
        },
      },
    ];

    for (const testCase of cases) {
      const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
      fetchImplementation.mockResolvedValue(
        responseWithJson(200, testCase.body),
      );
      const logError = jest.fn();
      const repository = new OpenAiLiveSessionRepository(
        fetchImplementation,
        () => 'secret-api-key',
        logError,
      );

      const result = await repository.createFromSdpOffer('OFFER-SDP');

      expect({ name: testCase.name, result }).toEqual({
        name: testCase.name,
        result: {
          type: 'openAiFailed',
          status: 502,
          message: 'OpenAI live session response has no session.id',
        },
      });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('502'));
      expect(logError.mock.calls.flat().join('\n')).not.toContain(
        'secret-api-key',
      );
    }
  });

  it('maps JSON error responses and logs each failure without the key', async () => {
    const cases = [400, 401, 429, 500].map((status) => ({
      status,
      message: `failure ${status}`,
    }));

    for (const testCase of cases) {
      const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
      fetchImplementation.mockResolvedValue(
        responseWithJson(testCase.status, {
          error: { message: testCase.message },
        }),
      );
      const logError = jest.fn();
      const repository = new OpenAiLiveSessionRepository(
        fetchImplementation,
        () => 'secret-api-key',
        logError,
      );

      await expect(repository.createFromSdpOffer('OFFER-SDP')).resolves.toEqual(
        {
          type: 'openAiFailed',
          status: testCase.status,
          message: testCase.message,
        },
      );
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining(String(testCase.status)),
      );
      expect(logError.mock.calls.flat().join('\n')).not.toContain(
        'secret-api-key',
      );
    }
  });

  it('returns a non-JSON error body as the failure message', async () => {
    const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
    fetchImplementation.mockResolvedValue(
      new Response('upstream unavailable', { status: 503 }),
    );
    const logError = jest.fn();
    const repository = new OpenAiLiveSessionRepository(
      fetchImplementation,
      () => 'secret-api-key',
      logError,
    );

    await expect(repository.createFromSdpOffer('OFFER-SDP')).resolves.toEqual({
      type: 'openAiFailed',
      status: 503,
      message: 'upstream unavailable',
    });
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('503'));
    expect(logError.mock.calls.flat().join('\n')).not.toContain(
      'secret-api-key',
    );
  });

  it('logs and maps a successful response without transport SDP as a 502 failure', async () => {
    const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
    fetchImplementation.mockResolvedValue(
      responseWithJson(200, {
        session: { id: 'live_123' },
        transport: { type: 'webrtc' },
      }),
    );
    const logError = jest.fn();
    const repository = new OpenAiLiveSessionRepository(
      fetchImplementation,
      () => 'secret-api-key',
      logError,
    );

    const result = await repository.createFromSdpOffer('OFFER-SDP');

    expect(result).toEqual({
      type: 'openAiFailed',
      status: 502,
      message: 'OpenAI live session response has no transport.sdp',
    });
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('502'));
    expect(logError.mock.calls.flat().join('\n')).not.toContain(
      'secret-api-key',
    );
  });

  it('logs and maps a rejected fetch as a 502 failure', async () => {
    const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
    fetchImplementation.mockRejectedValue(new Error('socket hang up'));
    const logError = jest.fn();
    const repository = new OpenAiLiveSessionRepository(
      fetchImplementation,
      () => 'secret-api-key',
      logError,
    );

    const result = await repository.createFromSdpOffer('OFFER-SDP');

    expect(result).toEqual({
      type: 'openAiFailed',
      status: 502,
      message: 'socket hang up',
    });
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('502'));
    expect(logError.mock.calls.flat().join('\n')).not.toContain(
      'secret-api-key',
    );
  });
});

describe('buildLiveSessionRequestBody', () => {
  it('requests GPT-Live with client delegation and the voice-role instructions only', () => {
    const parsed: unknown = JSON.parse(
      buildLiveSessionRequestBody('OFFER-SDP'),
    );

    expect(parsed).toEqual({
      session: {
        model: 'gpt-live-1',
        instructions: VOICE_CONSOLE_LIVE_INSTRUCTIONS,
        audio: { output: { voice: 'marin' } },
        delegation: { type: 'client' },
      },
      transport: { type: 'webrtc', sdp: 'OFFER-SDP' },
    });
  });

  it('sends no OpenAI Responses model, no responses key and no tool list', () => {
    const body = buildLiveSessionRequestBody('OFFER-SDP');
    const forbiddenTerms = ['gpt-6.2-astra', '"responses"', '"tools"'];

    for (const term of forbiddenTerms) {
      expect({ term, present: body.includes(term) }).toEqual({
        term,
        present: false,
      });
    }
  });

  it('is the body that the repository posts to the live session endpoint', async () => {
    const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
    fetchImplementation.mockResolvedValue(
      responseWithJson(201, {
        session: { id: 'live_123' },
        transport: { type: 'webrtc', sdp: 'ANSWER-SDP' },
      }),
    );
    const repository = new OpenAiLiveSessionRepository(
      fetchImplementation,
      () => 'secret-api-key',
      jest.fn(),
    );

    await repository.createFromSdpOffer('OFFER-SDP');

    expect(fetchImplementation.mock.calls[0]?.[1]?.body).toBe(
      buildLiveSessionRequestBody('OFFER-SDP'),
    );
  });
});
