import { extractWaitingForOwner } from './extractWaitingForOwner';

describe('extractWaitingForOwner', () => {
  it('returns true when waitingForOwner is true in a fenced json block', () => {
    expect(
      extractWaitingForOwner(
        'From: :robot: agent (model)\n\n```json\n{ "waitingForOwner": true }\n```\n\nbody text\n',
      ),
    ).toBe(true);
  });

  it('returns false when waitingForOwner is false', () => {
    expect(
      extractWaitingForOwner(
        'From: :robot: agent (model)\n\n```json\n{ "waitingForOwner": false }\n```\n',
      ),
    ).toBe(false);
  });

  it('returns false when the waitingForOwner field is absent', () => {
    expect(
      extractWaitingForOwner(
        'From: :robot: agent (model)\n\n```json\n{ "nextStepAgent": "pr-reviewer" }\n```\n',
      ),
    ).toBe(false);
  });

  it('returns false when the body has no fenced json block', () => {
    expect(extractWaitingForOwner('Please go ahead with that.')).toBe(false);
  });

  it('returns true when waitingForOwner is true in a block that is not the first fenced json block', () => {
    expect(
      extractWaitingForOwner(
        'From: :robot: agent (model)\n\n```json\n{ "nextStep": null }\n```\n\n## section\n\n```json\n{ "waitingForOwner": true }\n```\n',
      ),
    ).toBe(true);
  });
});
