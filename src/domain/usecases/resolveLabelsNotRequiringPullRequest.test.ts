import { resolveLabelsNotRequiringPullRequest } from './resolveLabelsNotRequiringPullRequest';

describe('resolveLabelsNotRequiringPullRequest', () => {
  it('combines both lists so an agent-name label keeps exempting the issue', () => {
    expect(
      resolveLabelsNotRequiringPullRequest({
        labelsAsLlmAgentName: ['chore', 'accounting'],
        labelsNotRequiringPullRequest: ['story'],
      }),
    ).toEqual(['chore', 'accounting', 'story']);
  });

  it('returns only the agent-name labels when no exemption list is configured', () => {
    expect(
      resolveLabelsNotRequiringPullRequest({
        labelsAsLlmAgentName: ['chore'],
      }),
    ).toEqual(['chore']);
  });

  it('returns only the exemption labels when no agent-name label is configured', () => {
    expect(
      resolveLabelsNotRequiringPullRequest({
        labelsAsLlmAgentName: null,
        labelsNotRequiringPullRequest: ['story'],
      }),
    ).toEqual(['story']);
  });

  it('returns an empty array when neither list is present', () => {
    expect(resolveLabelsNotRequiringPullRequest({})).toEqual([]);
  });
});
