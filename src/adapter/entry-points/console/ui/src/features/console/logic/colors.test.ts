import { CONSOLE_COLOR_PALETTE, colorFromEnum } from './colors';

describe('colorFromEnum', () => {
  it('returns the exact palette entry for a known enum', () => {
    expect(colorFromEnum('GREEN')).toEqual({
      dot: '#3fb950',
      bg: 'rgba(46,160,67,0.15)',
      fg: '#3fb950',
      border: 'rgba(46,160,67,0.4)',
    });
  });

  it('is case insensitive', () => {
    expect(colorFromEnum('purple')).toBe(CONSOLE_COLOR_PALETTE.PURPLE);
  });

  it('falls back to GRAY for an unknown enum', () => {
    expect(colorFromEnum('MAGENTA')).toBe(CONSOLE_COLOR_PALETTE.GRAY);
  });

  it('falls back to GRAY for null', () => {
    expect(colorFromEnum(null)).toBe(CONSOLE_COLOR_PALETTE.GRAY);
  });

  it('uses the documented dot colors for every enum', () => {
    expect(CONSOLE_COLOR_PALETTE.GRAY.dot).toBe('#848d97');
    expect(CONSOLE_COLOR_PALETTE.BLUE.dot).toBe('#4493f8');
    expect(CONSOLE_COLOR_PALETTE.YELLOW.dot).toBe('#d29922');
    expect(CONSOLE_COLOR_PALETTE.ORANGE.dot).toBe('#db6d28');
    expect(CONSOLE_COLOR_PALETTE.RED.dot).toBe('#f85149');
    expect(CONSOLE_COLOR_PALETTE.PINK.dot).toBe('#db61a2');
    expect(CONSOLE_COLOR_PALETTE.PURPLE.dot).toBe('#a371f7');
  });
});
