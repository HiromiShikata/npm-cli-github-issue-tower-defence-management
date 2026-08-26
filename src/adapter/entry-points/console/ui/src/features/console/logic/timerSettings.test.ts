import { findNextPjcodeWithMinutes } from './timerSettings';

describe('findNextPjcodeWithMinutes', () => {
  const pjcodes = ['alpha', 'beta', 'gamma'];

  it('returns the next pjcode after the current one with minutes > 0', () => {
    const minutes = { alpha: 5, beta: 5, gamma: 5 };
    expect(findNextPjcodeWithMinutes(pjcodes, 'alpha', minutes)).toBe('beta');
    expect(findNextPjcodeWithMinutes(pjcodes, 'beta', minutes)).toBe('gamma');
  });

  it('wraps around to the first pjcode after the last one', () => {
    const minutes = { alpha: 5, beta: 5, gamma: 5 };
    expect(findNextPjcodeWithMinutes(pjcodes, 'gamma', minutes)).toBe('alpha');
  });

  it('returns null when all projects have zero minutes', () => {
    const minutes = { alpha: 0, beta: 0, gamma: 0 };
    expect(findNextPjcodeWithMinutes(pjcodes, 'alpha', minutes)).toBeNull();
    expect(findNextPjcodeWithMinutes(pjcodes, null, minutes)).toBeNull();
  });

  it('skips projects with zero minutes', () => {
    const minutes = { alpha: 5, beta: 0, gamma: 5 };
    expect(findNextPjcodeWithMinutes(pjcodes, 'alpha', minutes)).toBe('gamma');
  });

  it('skips consecutive zero-minute projects and wraps around', () => {
    const minutes = { alpha: 5, beta: 0, gamma: 0 };
    expect(findNextPjcodeWithMinutes(pjcodes, 'alpha', minutes)).toBeNull();

    const minutes2 = { alpha: 0, beta: 5, gamma: 0 };
    expect(findNextPjcodeWithMinutes(pjcodes, 'gamma', minutes2)).toBe('beta');
  });

  it('returns the first pjcode with minutes > 0 when currentPjcode is null', () => {
    const minutes = { alpha: 0, beta: 5, gamma: 3 };
    expect(findNextPjcodeWithMinutes(pjcodes, null, minutes)).toBe('beta');
  });

  it('returns the first pjcode when currentPjcode is null and first has minutes > 0', () => {
    const minutes = { alpha: 10, beta: 5, gamma: 3 };
    expect(findNextPjcodeWithMinutes(pjcodes, null, minutes)).toBe('alpha');
  });

  it('treats missing projectMinutes entry as zero', () => {
    expect(findNextPjcodeWithMinutes(pjcodes, 'alpha', {})).toBeNull();
  });

  it('returns null for an empty pjcodes list', () => {
    expect(findNextPjcodeWithMinutes([], null, {})).toBeNull();
    expect(findNextPjcodeWithMinutes([], 'alpha', {})).toBeNull();
  });

  it('handles currentPjcode not found in the list like null-origin', () => {
    const minutes = { alpha: 5, beta: 5, gamma: 5 };
    expect(findNextPjcodeWithMinutes(pjcodes, 'unknown', minutes)).toBe(
      'alpha',
    );
  });
});
