export type TokenExhaustionHandoverStateEntry = {
  signaledAtEpoch: number;
  pid: number;
};

export type TokenExhaustionHandoverState = {
  entries: Record<string, TokenExhaustionHandoverStateEntry>;
};
