import { extractIterationsExhausted } from './extractIterationsExhausted';

describe('extractIterationsExhausted', () => {
  it('returns true when iterationsExhausted is true in a fenced json block', () => {
    expect(
      extractIterationsExhausted(
        'From: :robot: agent (model)\n\n```json\n{ "iterationsExhausted": true }\n```\n\nbody text\n',
      ),
    ).toBe(true);
  });

  it('returns false when iterationsExhausted is false', () => {
    expect(
      extractIterationsExhausted(
        'From: :robot: agent (model)\n\n```json\n{ "iterationsExhausted": false }\n```\n',
      ),
    ).toBe(false);
  });

  it('returns false when the iterationsExhausted field is absent', () => {
    expect(
      extractIterationsExhausted(
        'From: :robot: agent (model)\n\n```json\n{ "nextStepAgent": "pr-reviewer" }\n```\n',
      ),
    ).toBe(false);
  });

  it('returns false when the body has no fenced json block', () => {
    expect(extractIterationsExhausted('Please go ahead with that.')).toBe(
      false,
    );
  });

  it('returns true when iterationsExhausted is true in a block that is not the first fenced json block', () => {
    expect(
      extractIterationsExhausted(
        'From: :robot: agent (model)\n\n```json\n{ "nextStep": null }\n```\n\n## section\n\n```json\n{ "iterationsExhausted": true }\n```\n',
      ),
    ).toBe(true);
  });
});
