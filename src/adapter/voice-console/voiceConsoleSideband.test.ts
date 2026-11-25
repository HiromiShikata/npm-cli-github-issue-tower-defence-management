import { mock } from 'jest-mock-extended';
import type { VoiceConsoleDelegationBridge } from './voiceConsoleDelegationBridge';
import { VoiceConsoleSidebandHandler } from './voiceConsoleSideband';

const delegationCreated = (eventId: string, delegation: unknown) => ({
  type: 'session.delegation.created',
  event_id: eventId,
  delegation,
});

const createHandler = () => {
  const bridge = mock<VoiceConsoleDelegationBridge>();
  const send = jest.fn((_event: Record<string, unknown>): void => undefined);
  const logError = jest.fn((_message: string): void => undefined);
  const handler = new VoiceConsoleSidebandHandler(bridge, send, logError);
  return { bridge, send, logError, handler };
};

describe('VoiceConsoleSidebandHandler owner speech', () => {
  it('forwards only owner input transcript deltas to the bridge', async () => {
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
      const { bridge, handler } = createHandler();

      await handler.handleServerEvent(testCase.event);

      expect({
        name: testCase.name,
        bridged: bridge.handleOwnerTranscriptDelta.mock.calls.map(
          (call) => call[0],
        ),
      }).toEqual({ name: testCase.name, bridged: testCase.forwarded });
    }
  });

  it('ignores output transcript deltas of the assistant', async () => {
    const { bridge, send, logError, handler } = createHandler();

    await handler.handleServerEvent({
      type: 'session.output_transcript.delta',
      event_id: 'o1',
      delta: '読み上げ',
      start_ms: 0,
      end_ms: 100,
    });

    expect({
      bridgedOwner: bridge.handleOwnerTranscriptDelta.mock.calls.length,
      bridgedDelegation: bridge.handleDelegationCreated.mock.calls.length,
      sent: send.mock.calls.length,
      logged: logError.mock.calls.length,
    }).toEqual({ bridgedOwner: 0, bridgedDelegation: 0, sent: 0, logged: 0 });
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
