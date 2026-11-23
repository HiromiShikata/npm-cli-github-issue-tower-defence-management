export type LiveSessionCreateResult =
  | { type: 'created'; sdpAnswer: string; sessionId: string }
  | { type: 'apiKeyMissing' }
  | { type: 'openAiFailed'; status: number; message: string };

export interface LiveSessionRepository {
  createFromSdpOffer(sdpOffer: string): Promise<LiveSessionCreateResult>;
}
