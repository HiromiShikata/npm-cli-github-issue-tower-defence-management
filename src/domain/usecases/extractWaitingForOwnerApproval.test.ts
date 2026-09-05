import { extractWaitingForOwnerApproval } from './extractWaitingForOwnerApproval';

describe('extractWaitingForOwnerApproval', () => {
  it('returns true when JSON block has waitingForOwnerApproval: true', () => {
    expect(
      extractWaitingForOwnerApproval(
        'From: :robot: agent (model)\n\n```json\n{ "waitingForOwnerApproval": true }\n```\n',
      ),
    ).toBe(true);
  });

  it('returns false when JSON block has waitingForOwnerApproval: false', () => {
    expect(
      extractWaitingForOwnerApproval(
        'From: :robot: agent (model)\n\n```json\n{ "waitingForOwnerApproval": false }\n```\n',
      ),
    ).toBe(false);
  });

  it('returns false when JSON block has no waitingForOwnerApproval key', () => {
    expect(
      extractWaitingForOwnerApproval(
        'From: :robot: agent (model)\n\n```json\n{ "nextStep": null }\n```\n',
      ),
    ).toBe(false);
  });

  it('returns false when body has no JSON block', () => {
    expect(extractWaitingForOwnerApproval('Please go ahead with that.')).toBe(
      false,
    );
  });

  it('returns true when JSON has other keys plus waitingForOwnerApproval: true', () => {
    expect(
      extractWaitingForOwnerApproval(
        'From: :robot: systems-analyst (model)\n\n```json\n{ "pullRequestRequired": false, "waitingForOwnerApproval": true }\n```\n',
      ),
    ).toBe(true);
  });
});
