import { mock } from 'jest-mock-extended';
import type { VoiceConsoleDelegationBridge } from './voiceConsoleDelegationBridge';
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

const delegationCreated = (eventId: string, delegation: unknown) => ({
  type: 'session.delegation.created',
  event_id: eventId,
  delegation,
});

const createFakeSession = () => {
  const callTool = jest.fn(
    (_name: string, _argumentsJson: string): Promise<string> =>
      Promise.resolve(TOOL_RESULT),
  );
  const recordOwnerSpeech = jest.fn((_delta: string): void => undefined);
  const recordAssistantSpeech = jest.fn((_delta: string): void => undefined);
  return {
    callTool,
    recordOwnerSpeech,
    recordAssistantSpeech,
    session: { callTool, recordOwnerSpeech, recordAssistantSpeech },
  };
};

const createHandler = () => {
  const fake = createFakeSession();
  const bridge = mock<VoiceConsoleDelegationBridge>();
  const send = jest.fn((_event: Record<string, unknown>): void => undefined);
  const logError = jest.fn((_message: string): void => undefined);
  const handler = new VoiceConsoleSidebandHandler(
    fake.session,
    bridge,
    send,
    logError,
  );
  return { ...fake, bridge, send, logError, handler };
};

describe('VoiceConsoleSidebandHandler owner speech', () => {
  it('forwards only owner input transcript deltas to recordOwnerSpeech and the bridge', async () => {
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
      const { recordOwnerSpeech, bridge, handler } = createHandler();

      await handler.handleServerEvent(testCase.event);

      expect({
        name: testCase.name,
        forwarded: recordOwnerSpeech.mock.calls.map((call) => call[0]),
        bridged: bridge.handleOwnerTranscriptDelta.mock.calls.map(
          (call) => call[0],
        ),
      }).toEqual({
        name: testCase.name,
        forwarded: testCase.forwarded,
        bridged: testCase.forwarded,
      });
    }
  });
});

describe('VoiceConsoleSidebandHandler assistant speech', () => {
  it('forwards output transcript deltas to recordAssistantSpeech and input deltas to recordOwnerSpeech only', async () => {
    const cases = [
      {
        name: 'an output transcript delta is forwarded to the assistant speech',
        event: {
          type: 'session.output_transcript.delta',
          event_id: 'o1',
          delta: '読み上げ',
          start_ms: 0,
          end_ms: 100,
        },
        assistantForwarded: ['読み上げ'],
        ownerForwarded: [],
      },
      {
        name: 'an input transcript delta is forwarded to the owner speech',
        event: {
          type: 'session.input_transcript.delta',
          event_id: 'i1',
          delta: 'はい',
          start_ms: 0,
          end_ms: 100,
        },
        assistantForwarded: [],
        ownerForwarded: ['はい'],
      },
      {
        name: 'a response text delta is forwarded to neither',
        event: { type: 'response.output_text.delta', delta: 'はい' },
        assistantForwarded: [],
        ownerForwarded: [],
      },
    ];

    for (const testCase of cases) {
      const { recordAssistantSpeech, recordOwnerSpeech, handler } =
        createHandler();

      await handler.handleServerEvent(testCase.event);

      expect({
        name: testCase.name,
        assistant: recordAssistantSpeech.mock.calls.map((call) => call[0]),
        owner: recordOwnerSpeech.mock.calls.map((call) => call[0]),
      }).toEqual({
        name: testCase.name,
        assistant: testCase.assistantForwarded,
        owner: testCase.ownerForwarded,
      });
    }
  });
});

describe('VoiceConsoleSidebandHandler function calls', () => {
  it('no longer runs a tool or sends any event for a function call', async () => {
    const { callTool, send, logError, bridge, handler } = createHandler();

    await handler.handleServerEvent(
      delegated('c0', { type: 'response.created', response: { id: 'resp_1' } }),
    );
    await handler.handleServerEvent(
      functionCallDone('e2', 'call_1', 'queue_overview', '{}'),
    );
    await handler.handleServerEvent(
      delegated('e3', {
        type: 'response.completed',
        response: { id: 'resp_1' },
      }),
    );

    expect({
      callTool: callTool.mock.calls.length,
      sent: send.mock.calls.length,
      logged: logError.mock.calls.length,
      bridged: bridge.handleDelegationCreated.mock.calls.length,
    }).toEqual({ callTool: 0, sent: 0, logged: 0, bridged: 0 });
  });
});

describe('VoiceConsoleSidebandHandler delegation', () => {
  it('hands the delegation id of a created delegation to the bridge', async () => {
    const { bridge, send, handler } = createHandler();

    await handler.handleServerEvent(
      delegationCreated('d1', { id: 'delegation_1', type: 'client' }),
    );

    expect({
      delegationIds: bridge.handleDelegationCreated.mock.calls.map(
        (call) => call[0],
      ),
      sent: send.mock.calls.length,
    }).toEqual({ delegationIds: ['delegation_1'], sent: 0 });
  });

  it('logs and does not call the bridge for a created delegation without a string id', async () => {
    const cases = [
      { name: 'no delegation object', delegation: undefined },
      { name: 'delegation without id', delegation: { type: 'client' } },
      { name: 'non-string id', delegation: { id: 5 } },
    ];

    for (const testCase of cases) {
      const { bridge, logError, handler } = createHandler();

      await handler.handleServerEvent(
        delegationCreated('d2', testCase.delegation),
      );

      expect({
        name: testCase.name,
        bridged: bridge.handleDelegationCreated.mock.calls.length,
        logged: logError.mock.calls.length,
      }).toEqual({ name: testCase.name, bridged: 0, logged: 1 });
    }
  });

  it('ignores other delegation events', async () => {
    const { bridge, logError, handler } = createHandler();

    await handler.handleServerEvent({
      type: 'session.delegation.updated',
      event_id: 'd3',
      delegation: { id: 'delegation_1' },
    });

    expect({
      bridged: bridge.handleDelegationCreated.mock.calls.length,
      logged: logError.mock.calls.length,
    }).toEqual({ bridged: 0, logged: 0 });
  });
});
