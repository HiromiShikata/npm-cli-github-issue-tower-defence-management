import type { VoiceConsoleDelegationBridge } from './voiceConsoleDelegationBridge';

export type VoiceConsoleSidebandBridge = Pick<
  VoiceConsoleDelegationBridge,
  'handleOwnerTranscriptDelta' | 'handleDelegationCreated'
>;

export type VoiceConsoleSendEvent = (event: Record<string, unknown>) => void;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readDelegationId = (delegation: unknown): string | null =>
  isRecord(delegation) && typeof delegation.id === 'string'
    ? delegation.id
    : null;

export class VoiceConsoleSidebandHandler {
  constructor(
    private readonly bridge: VoiceConsoleSidebandBridge,
    private readonly send: VoiceConsoleSendEvent,
    private readonly logError: (message: string) => void,
  ) {}

  async handleServerEvent(event: unknown): Promise<void> {
    if (!isRecord(event)) return;
    if (
      event.type === 'session.input_transcript.delta' &&
      typeof event.delta === 'string'
    ) {
      this.bridge.handleOwnerTranscriptDelta(event.delta);
      return;
    }
    if (event.type === 'session.delegation.created') {
      const delegationId = readDelegationId(event.delegation);
      if (delegationId === null) {
        this.logError(
          'voice console received session.delegation.created without a string delegation.id',
        );
        return;
      }
      this.bridge.handleDelegationCreated(delegationId);
    }
  }
}
