import { VoiceConsoleSidebandHandler } from './voiceConsoleSideband';

const TOOL_RESULT = '{"ok":true,"text":"日本語の結果"}';

const delegated = (
  eventId: string,
  event: Record<string, unknown>,
): Record<string, unknown> => ({
  type: 'response.event',
  event_id: eventId,
  delegation_id: 'delegation_1',
  event,
});

const responseCreated = (eventId: string, responseId: string) =>
  delegated(eventId, {
    type: 'response.created',
    response: { id: responseId },
  });

const functionCallDone = (
  eventId: string,
  callId: string,
  name: string,
  argumentsJson: string,
) =>
  delegated(eventId, {
    type: 'response.output_item.done',
    item: {
      type: 'function_call',
      call_id: callId,
      name,
      arguments: argumentsJson,
    },
  });

const responseCompleted = (eventId: string, responseId?: string) =>
  delegated(eventId, {
    type: 'response.completed',
    response: responseId === undefined ? {} : { id: responseId },
  });

const outputItemEvent = (callId: string) => ({
  type: 'response.item.create',
  event_id: `voice_tool_result_${callId}`,
  item: {
    type: 'function_call_output',
    call_id: callId,
    output: TOOL_RESULT,
  },
});

const continueEvent = (responseId: string) => ({
  type: 'response.create',
  event_id: `voice_continue_${responseId}`,
});

const createFakeSession = () => {
  const callTool = jest.fn(
    (_name: string, _argumentsJson: string): Promise<string> =>
      Promise.resolve(TOOL_RESULT),
  );
  const recordOwnerSpeech = jest.fn((_delta: string): void => undefined);
  return {
    callTool,
    recordOwnerSpeech,
    session: { callTool, recordOwnerSpeech },
  };
};

describe('VoiceConsoleSidebandHandler', () => {
  it('submits the collected function call outputs and one continue after each completed response', async () => {
    const scenarios: {
      name: string;
      events: unknown[];
      expectedCalls: [string, string][];
      expectedSent: Record<string, unknown>[];
    }[] = [
      {
        name: 'one call is executed and its output sent after completed',
        events: [
          responseCreated('e1', 'resp_1'),
          functionCallDone('e2', 'call_1', 'queue_overview', '{}'),
          responseCompleted('e3', 'resp_1'),
        ],
        expectedCalls: [['queue_overview', '{}']],
        expectedSent: [outputItemEvent('call_1'), continueEvent('resp_1')],
      },
      {
        name: 'two calls in one response give two outputs and exactly one continue',
        events: [
          responseCreated('e1', 'resp_1'),
          functionCallDone('e2', 'call_1', 'next_task', '{}'),
          functionCallDone('e3', 'call_2', 'queue_overview', '{}'),
          responseCompleted('e4', 'resp_1'),
        ],
        expectedCalls: [
          ['next_task', '{}'],
          ['queue_overview', '{}'],
        ],
        expectedSent: [
          outputItemEvent('call_1'),
          outputItemEvent('call_2'),
          continueEvent('resp_1'),
        ],
      },
      {
        name: 'a function call replayed with the same call_id runs once',
        events: [
          responseCreated('e1', 'resp_1'),
          functionCallDone('e2', 'call_1', 'queue_overview', '{}'),
          functionCallDone('e3', 'call_1', 'queue_overview', '{}'),
          responseCompleted('e4', 'resp_1'),
        ],
        expectedCalls: [['queue_overview', '{}']],
        expectedSent: [outputItemEvent('call_1'), continueEvent('resp_1')],
      },
      {
        name: 'a replayed completed event is not submitted again',
        events: [
          responseCreated('e1', 'resp_1'),
          functionCallDone('e2', 'call_1', 'queue_overview', '{}'),
          responseCompleted('e3', 'resp_1'),
          responseCompleted('e4', 'resp_1'),
        ],
        expectedCalls: [['queue_overview', '{}']],
        expectedSent: [outputItemEvent('call_1'), continueEvent('resp_1')],
      },
      {
        name: 'a server event with an event_id already seen is ignored entirely',
        events: [
          responseCreated('e1', 'resp_1'),
          functionCallDone('e2', 'call_1', 'queue_overview', '{}'),
          functionCallDone('e2', 'call_2', 'next_task', '{}'),
          responseCompleted('e3', 'resp_1'),
        ],
        expectedCalls: [['queue_overview', '{}']],
        expectedSent: [outputItemEvent('call_1'), continueEvent('resp_1')],
      },
      {
        name: 'a completed event without a response id uses the current response id',
        events: [
          responseCreated('e1', 'resp_1'),
          functionCallDone('e2', 'call_1', 'queue_overview', '{}'),
          responseCompleted('e3'),
        ],
        expectedCalls: [['queue_overview', '{}']],
        expectedSent: [outputItemEvent('call_1'), continueEvent('resp_1')],
      },
      {
        name: 'calls of two responses are submitted with their own completed event',
        events: [
          responseCreated('e1', 'resp_1'),
          functionCallDone('e2', 'call_1', 'queue_overview', '{}'),
          responseCreated('e3', 'resp_2'),
          functionCallDone('e4', 'call_2', 'next_task', '{}'),
          responseCompleted('e5', 'resp_1'),
          responseCompleted('e6', 'resp_2'),
        ],
        expectedCalls: [
          ['queue_overview', '{}'],
          ['next_task', '{}'],
        ],
        expectedSent: [
          outputItemEvent('call_1'),
          continueEvent('resp_1'),
          outputItemEvent('call_2'),
          continueEvent('resp_2'),
        ],
      },
      {
        name: 'other event types are ignored and never executed or sent',
        events: [
          { type: 'session.updated', session: {} },
          delegated('e1', { type: 'response.output_text.delta', delta: 'x' }),
          delegated('e2', {
            type: 'response.output_item.added',
            item: {
              type: 'function_call',
              call_id: 'call_1',
              name: 'queue_overview',
              arguments: '{}',
            },
          }),
        ],
        expectedCalls: [],
        expectedSent: [],
      },
    ];

    for (const scenario of scenarios) {
      const { callTool, session } = createFakeSession();
      const send = jest.fn(
        (_event: Record<string, unknown>): void => undefined,
      );
      const logError = jest.fn();
      const handler = new VoiceConsoleSidebandHandler(session, send, logError);

      for (const event of scenario.events) {
        await handler.handleServerEvent(event);
      }

      expect({
        name: scenario.name,
        calls: callTool.mock.calls.map((call) => [call[0], call[1]]),
        sent: send.mock.calls.map((call) => call[0]),
      }).toEqual({
        name: scenario.name,
        calls: scenario.expectedCalls,
        sent: scenario.expectedSent,
      });
    }
  });

  it('executes a function call on output_item.done but sends nothing before the completed event', async () => {
    const { callTool, session } = createFakeSession();
    const send = jest.fn((_event: Record<string, unknown>): void => undefined);
    const handler = new VoiceConsoleSidebandHandler(session, send, jest.fn());

    await handler.handleServerEvent(responseCreated('e1', 'resp_1'));
    await handler.handleServerEvent(
      functionCallDone('e2', 'call_1', 'queue_overview', '{}'),
    );

    expect(callTool).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('VoiceConsoleSidebandHandler owner speech', () => {
  it('forwards only owner input transcript deltas to recordOwnerSpeech', async () => {
    const cases = [
      {
        name: 'an input transcript delta is forwarded with its text',
        event: {
          type: 'session.input_transcript.delta',
          event_id: 't1',
          delta: 'は',
          start_ms: 0,
          end_ms: 100,
        },
        forwarded: ['は'],
      },
      {
        name: 'a second fragment is forwarded in order',
        event: {
          type: 'session.input_transcript.delta',
          event_id: 't2',
          delta: 'い',
          start_ms: 100,
          end_ms: 200,
        },
        forwarded: ['い'],
      },
      {
        name: 'an output text delta is not forwarded',
        event: { type: 'response.output_text.delta', delta: 'はい' },
        forwarded: [],
      },
      {
        name: 'a session update is not forwarded',
        event: { type: 'session.updated', session: {} },
        forwarded: [],
      },
    ];

    for (const testCase of cases) {
      const { recordOwnerSpeech, session } = createFakeSession();
      const handler = new VoiceConsoleSidebandHandler(
        session,
        jest.fn(),
        jest.fn(),
      );

      await handler.handleServerEvent(testCase.event);

      expect({
        name: testCase.name,
        forwarded: recordOwnerSpeech.mock.calls.map((call) => call[0]),
      }).toEqual({ name: testCase.name, forwarded: testCase.forwarded });
    }
  });
});
