import { OpenAiLiveSessionRepository } from './OpenAiLiveSessionRepository';

const instructions =
  'あなたはオーナーの音声アシスタントです。オーナーは複数の作業セッションからの呼び出しに、順番に声で答えています。アプリが呼び出しの本文を読み上げた後、あなたはオーナーと日本語で短く会話し、そのセッションに送る返事を決める手助けをします。オーナーが送る文を述べたら、その文を一字一句そのまま復唱し、オーナーが「送って」と言ったら、その文をそのまま session_reply_send で送ります。送る文を自分で作ったり言い換えたりしてはいけません。オーナーが「次」と言ったら session_skip を、「もう一度」と言ったら owner_call_repeat を呼びます。';

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
      model: 'gpt-live-1',
      instructions,
      audio: { output: { voice: 'harema' } },
      delegation: {
        type: 'responses',
        responses: {
          model: 'gpt-6-luna',
          tools: [
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
              parameters: {
                type: 'object',
                properties: {},
                additionalProperties: false,
              },
            },
            {
              type: 'function',
              name: 'owner_call_repeat',
              parameters: {
                type: 'object',
                properties: {},
                additionalProperties: false,
              },
            },
          ],
        },
      },
      transport: { type: 'webrtc', sdp: 'OFFER-SDP' },
    });
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
    });
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
      message: expect.any(String),
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
      message: expect.stringContaining('socket hang up'),
    });
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('502'));
    expect(logError.mock.calls.flat().join('\n')).not.toContain(
      'secret-api-key',
    );
  });
});
