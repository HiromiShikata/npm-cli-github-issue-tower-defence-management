import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

export type IssueCloseStateReason = 'completed' | 'not_planned';

export type CloseIssueAsRequest =
  | { kind: 'notRequested' }
  | { kind: 'requested'; stateReason: IssueCloseStateReason }
  | { kind: 'invalidValue'; receivedValueJson: string };

export const extractCloseIssueAs = (body: string): CloseIssueAsRequest => {
  const blocks = extractFencedJsonBlocks(body, 'closeIssueAs');
  const lastBlock = blocks[blocks.length - 1];
  if (typeof lastBlock !== 'object' || lastBlock === null) {
    return { kind: 'notRequested' };
  }
  if (!('closeIssueAs' in lastBlock)) {
    return { kind: 'notRequested' };
  }
  const value: unknown = Reflect.get(lastBlock, 'closeIssueAs');
  if (value === null) {
    return { kind: 'notRequested' };
  }
  if (value === 'completed' || value === 'not_planned') {
    return { kind: 'requested', stateReason: value };
  }
  return { kind: 'invalidValue', receivedValueJson: JSON.stringify(value) };
};
