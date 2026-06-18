import { CONSOLE_COLOR_PALETTE, colorFromEnum } from './colors';

describe('colorFromEnum', () => {
  it('returns the matching palette entry for a known uppercase color', () => {
    expect(colorFromEnum('GREEN')).toEqual(CONSOLE_COLOR_PALETTE.GREEN);
  });

  it('resolves the palette entry case-insensitively', () => {
    expect(colorFromEnum('purple')).toEqual(CONSOLE_COLOR_PALETTE.PURPLE);
  });

  it('falls back to GRAY for an unknown color', () => {
    expect(colorFromEnum('rainbow')).toEqual(CONSOLE_COLOR_PALETTE.GRAY);
  });

  it('falls back to GRAY for a null color', () => {
    expect(colorFromEnum(null)).toEqual(CONSOLE_COLOR_PALETTE.GRAY);
  });

  it('exposes the exact prototype palette values for BLUE', () => {
    expect(CONSOLE_COLOR_PALETTE.BLUE).toEqual({
      dot: '#4493f8',
      bg: 'rgba(56,139,253,0.1)',
      fg: '#388bfd',
      border: 'rgba(56,139,253,0.4)',
    });
  });
});
