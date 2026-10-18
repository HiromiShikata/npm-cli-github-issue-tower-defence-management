import {
  DEFAULT_TIMER_MINUTES,
  findNextPjcodeWithMinutes,
} from './timerSettings';

describe('findNextPjcodeWithMinutes', () => {
  const pjcodes = ['alpha', 'beta', 'gamma'];

  it('returns the next pjcode after the current one with minutes > 0', () => {
    const minutes = { alpha: 5, beta: 5, gamma: 5 };
    expect(
      findNextPjcodeWithMinutes(pjcodes, 'alpha', minutes, { beta: 1 }, {}),
    ).toBe('beta');
    expect(
      findNextPjcodeWithMinutes(pjcodes, 'beta', minutes, { gamma: 1 }, {}),
    ).toBe('gamma');
  });

  it('wraps around to the first pjcode after the last one', () => {
    const minutes = { alpha: 5, beta: 5, gamma: 5 };
    expect(
      findNextPjcodeWithMinutes(pjcodes, 'gamma', minutes, { alpha: 1 }, {}),
    ).toBe('alpha');
  });

  it('returns null when all projects have zero minutes', () => {
    const minutes = { alpha: 0, beta: 0, gamma: 0 };
    expect(
      findNextPjcodeWithMinutes(pjcodes, 'alpha', minutes, {}, {}),
    ).toBeNull();
    expect(
      findNextPjcodeWithMinutes(pjcodes, null, minutes, {}, {}),
    ).toBeNull();
  });

  it('skips projects with zero minutes', () => {
    const minutes = { alpha: 5, beta: 0, gamma: 5 };
    expect(
      findNextPjcodeWithMinutes(pjcodes, 'alpha', minutes, { gamma: 1 }, {}),
    ).toBe('gamma');
  });

  it('skips consecutive zero-minute projects and wraps around', () => {
    const minutes = { alpha: 5, beta: 0, gamma: 0 };
    expect(
      findNextPjcodeWithMinutes(pjcodes, 'alpha', minutes, {}, {}),
    ).toBeNull();

    const minutes2 = { alpha: 0, beta: 5, gamma: 0 };
    expect(
      findNextPjcodeWithMinutes(pjcodes, 'gamma', minutes2, { beta: 1 }, {}),
    ).toBe('beta');
  });

  it('returns the first pjcode with minutes > 0 when currentPjcode is null', () => {
    const minutes = { alpha: 0, beta: 5, gamma: 3 };
    expect(
      findNextPjcodeWithMinutes(pjcodes, null, minutes, { beta: 1 }, {}),
    ).toBe('beta');
  });

  it('returns the first pjcode when currentPjcode is null and first has minutes > 0', () => {
    const minutes = { alpha: 10, beta: 5, gamma: 3 };
    expect(
      findNextPjcodeWithMinutes(pjcodes, null, minutes, { alpha: 1 }, {}),
    ).toBe('alpha');
  });

  it('treats missing projectMinutes entry as DEFAULT_TIMER_MINUTES', () => {
    expect(DEFAULT_TIMER_MINUTES).toBe(15);
    expect(
      findNextPjcodeWithMinutes(pjcodes, 'alpha', {}, { beta: 1 }, {}),
    ).toBe('beta');
    expect(findNextPjcodeWithMinutes(pjcodes, null, {}, { alpha: 1 }, {})).toBe(
      'alpha',
    );
  });

  it('skips only explicitly zero projects when some entries are missing', () => {
    expect(
      findNextPjcodeWithMinutes(
        pjcodes,
        'alpha',
        { beta: 0 },
        { gamma: 1 },
        {},
      ),
    ).toBe('gamma');
  });

  it('returns null for an empty pjcodes list', () => {
    expect(findNextPjcodeWithMinutes([], null, {}, {}, {})).toBeNull();
    expect(findNextPjcodeWithMinutes([], 'alpha', {}, {}, {})).toBeNull();
  });

  it('handles currentPjcode not found in the list like null-origin', () => {
    const minutes = { alpha: 5, beta: 5, gamma: 5 };
    expect(
      findNextPjcodeWithMinutes(pjcodes, 'unknown', minutes, { alpha: 1 }, {}),
    ).toBe('alpha');
  });
});
