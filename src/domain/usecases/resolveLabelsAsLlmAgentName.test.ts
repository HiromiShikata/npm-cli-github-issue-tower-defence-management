import { resolveLabelsAsLlmAgentName } from './resolveLabelsAsLlmAgentName';

describe('resolveLabelsAsLlmAgentName', () => {
  it('returns the top-level value when it is present', () => {
    expect(
      resolveLabelsAsLlmAgentName({
        topLevel: ['story', 'chore'],
        startPreparation: ['accounting'],
      }),
    ).toEqual(['story', 'chore']);
  });

  it('falls back to the startPreparation value when the top-level value is null', () => {
    expect(
      resolveLabelsAsLlmAgentName({
        topLevel: null,
        startPreparation: ['story', 'chore'],
      }),
    ).toEqual(['story', 'chore']);
  });

  it('falls back to the startPreparation value when the top-level value is undefined', () => {
    expect(
      resolveLabelsAsLlmAgentName({
        startPreparation: ['story'],
      }),
    ).toEqual(['story']);
  });

  it('returns an empty array when neither value is present', () => {
    expect(resolveLabelsAsLlmAgentName({})).toEqual([]);
  });

  it('prefers an empty top-level array over the startPreparation fallback', () => {
    expect(
      resolveLabelsAsLlmAgentName({
        topLevel: [],
        startPreparation: ['story'],
      }),
    ).toEqual([]);
  });
});
