import { isWaitingForOwnerApproval } from './isWaitingForOwnerApproval';

const agentReport = (reportJson: string): string =>
  `From: :robot: agent-name (model-id)\n\`\`\`json\n${reportJson}\n\`\`\``;

describe('isWaitingForOwnerApproval', () => {
  it('returns true when the first block has pullRequestRequired false and waitingForOwnerApproval true', () => {
    expect(
      isWaitingForOwnerApproval(
        agentReport(
          '{"pullRequestRequired": false, "waitingForOwnerApproval": true}',
        ),
      ),
    ).toBe(true);
  });

  it('returns false when waitingForOwnerApproval is missing', () => {
    expect(
      isWaitingForOwnerApproval(
        agentReport('{"pullRequestRequired": false}'),
      ),
    ).toBe(false);
  });

  it('returns false when pullRequestRequired is missing', () => {
    expect(
      isWaitingForOwnerApproval(
        agentReport('{"waitingForOwnerApproval": true}'),
      ),
    ).toBe(false);
  });

  it('returns false when pullRequestRequired is true', () => {
    expect(
      isWaitingForOwnerApproval(
        agentReport(
          '{"pullRequestRequired": true, "waitingForOwnerApproval": true}',
        ),
      ),
    ).toBe(false);
  });

  it('returns false when waitingForOwnerApproval is false', () => {
    expect(
      isWaitingForOwnerApproval(
        agentReport(
          '{"pullRequestRequired": false, "waitingForOwnerApproval": false}',
        ),
      ),
    ).toBe(false);
  });

  it('returns false when waitingForOwnerApproval is a string rather than the boolean true', () => {
    expect(
      isWaitingForOwnerApproval(
        agentReport(
          '{"pullRequestRequired": false, "waitingForOwnerApproval": "true"}',
        ),
      ),
    ).toBe(false);
  });

  it('returns false when there is no JSON block', () => {
    expect(
      isWaitingForOwnerApproval('From: :robot: agent-name (model-id)'),
    ).toBe(false);
  });

  it('returns false when the JSON block cannot be parsed', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      isWaitingForOwnerApproval(
        agentReport(
          '{"pullRequestRequired": false, "waitingForOwnerApproval": true',
        ),
      ),
    ).toBe(false);
    consoleWarn.mockRestore();
  });

  it('reads only the first block and ignores subsequent blocks', () => {
    const content = `From: :robot: agent-name (model-id)\n\`\`\`json\n{"pullRequestRequired": false, "nextStep": null}\n\`\`\`\n\n\`\`\`json\n{"pullRequestRequired": false, "waitingForOwnerApproval": true}\n\`\`\``;
    expect(isWaitingForOwnerApproval(content)).toBe(false);
  });

  it('returns true when backticks in the block are backslash-escaped', () => {
    const content =
      'From: :robot: agent-name (model-id)\n\\`\\`\\`json\n{"pullRequestRequired": false, "waitingForOwnerApproval": true}\n\\`\\`\\`';
    expect(isWaitingForOwnerApproval(content)).toBe(true);
  });
});
