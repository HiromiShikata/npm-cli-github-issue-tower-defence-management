export type VoiceConsoleToolCaller = {
  callTool(name: string, argumentsJson: string): Promise<string>;
};

export type VoiceConsoleSidebandSession = VoiceConsoleToolCaller & {
  recordOwnerSpeech(delta: string): void;
};

export type VoiceConsoleSendEvent = (event: Record<string, unknown>) => void;

type CollectedFunctionCall = {
  callId: string;
  output: string;
};

type PendingResponse = {
  calls: CollectedFunctionCall[];
};

type DelegatedServerEvent = {
  eventId: string | null;
  inner: Record<string, unknown>;
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOwnerInputTranscriptDelta = (
  event: unknown,
): event is { delta: string } =>
  isRecord(event) &&
  event.type === 'session.input_transcript.delta' &&
  typeof event.delta === 'string';

const readDelegatedServerEvent = (
  event: unknown,
): DelegatedServerEvent | null => {
  if (!isRecord(event) || event.type !== 'response.event') {
    return null;
  }
  if (!isRecord(event.event)) {
    return null;
  }
  return {
    eventId: typeof event.event_id === 'string' ? event.event_id : null,
    inner: event.event,
  };
};

const readResponseId = (inner: Record<string, unknown>): string | null => {
  const response = inner.response;
  if (isRecord(response) && typeof response.id === 'string') {
    return response.id;
  }
  return null;
};

const readFunctionCall = (
  item: Record<string, unknown>,
): { callId: string; name: string; argumentsJson: string } => {
  if (
    typeof item.call_id !== 'string' ||
    typeof item.name !== 'string' ||
    typeof item.arguments !== 'string'
  ) {
    throw new Error(
      'function_call item has no string call_id, name or arguments',
    );
  }
  return {
    callId: item.call_id,
    name: item.name,
    argumentsJson: item.arguments,
  };
};

const toolResultEvent = (
  call: CollectedFunctionCall,
): Record<string, unknown> => ({
  type: 'response.item.create',
  event_id: `voice_tool_result_${call.callId}`,
  item: {
    type: 'function_call_output',
    call_id: call.callId,
    output: call.output,
  },
});

const continueEvent = (responseId: string): Record<string, unknown> => ({
  type: 'response.create',
  event_id: `voice_continue_${responseId}`,
});

export class VoiceConsoleSidebandHandler {
  private readonly seenEventIds = new Set<string>();
  private readonly seenCallIds = new Set<string>();
  private readonly pendingResponses = new Map<string, PendingResponse>();
  private currentResponseId: string | null = null;
  private processing: Promise<void> = Promise.resolve();

  constructor(
    private readonly session: VoiceConsoleSidebandSession,
    private readonly send: VoiceConsoleSendEvent,
    private readonly logError: (message: string) => void,
  ) {}

  // Events run one after another so that a completed event never overtakes
  // the tool calls of its response. A failure is logged, never dropped.
  handleServerEvent(event: unknown): Promise<void> {
    const run = this.processing
      .then(() => this.processServerEvent(event))
      .catch((error: unknown) => {
        this.logError(
          `voice console server event failed: ${describeError(error)}`,
        );
      });
    this.processing = run;
    return run;
  }

  private async processServerEvent(event: unknown): Promise<void> {
    if (isOwnerInputTranscriptDelta(event)) {
      this.session.recordOwnerSpeech(event.delta);
      return;
    }
    const delegated = readDelegatedServerEvent(event);
    if (delegated === null) {
      return;
    }
    if (delegated.eventId !== null) {
      if (this.seenEventIds.has(delegated.eventId)) {
        return;
      }
      this.seenEventIds.add(delegated.eventId);
    }
    const inner = delegated.inner;
    if (inner.type === 'response.created') {
      const responseId = readResponseId(inner);
      if (responseId !== null) {
        this.currentResponseId = responseId;
      }
      return;
    }
    if (inner.type === 'response.output_item.done') {
      if (isRecord(inner.item) && inner.item.type === 'function_call') {
        await this.collectFunctionCall(inner.item);
      }
      return;
    }
    if (inner.type === 'response.completed' || inner.type === 'response.done') {
      this.submitResponse(readResponseId(inner) ?? this.currentResponseId);
    }
  }

  private async collectFunctionCall(
    item: Record<string, unknown>,
  ): Promise<void> {
    const call = readFunctionCall(item);
    if (this.seenCallIds.has(call.callId)) {
      return;
    }
    this.seenCallIds.add(call.callId);
    if (this.currentResponseId === null) {
      throw new Error(
        `function call ${call.callId} arrived before any response.created`,
      );
    }
    const output = await this.session.callTool(call.name, call.argumentsJson);
    const pending = this.pendingResponses.get(this.currentResponseId) ?? {
      calls: [],
    };
    pending.calls.push({ callId: call.callId, output });
    this.pendingResponses.set(this.currentResponseId, pending);
  }

  private submitResponse(responseId: string | null): void {
    if (responseId === null) {
      throw new Error('response completed without a response id');
    }
    const pending = this.pendingResponses.get(responseId);
    if (pending === undefined) {
      return;
    }
    this.pendingResponses.delete(responseId);
    if (pending.calls.length === 0) {
      return;
    }
    for (const call of pending.calls) {
      this.send(toolResultEvent(call));
    }
    this.send(continueEvent(responseId));
  }
}
