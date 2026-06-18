import type { ConsoleColor } from './types';

export type ConsoleColorPaletteEntry = {
  dot: string;
  bg: string;
  fg: string;
  border: string;
};

export const CONSOLE_COLOR_PALETTE: Record<
  ConsoleColor,
  ConsoleColorPaletteEntry
> = {
  GRAY: {
    dot: '#848d97',
    bg: 'rgba(110,118,129,0.1)',
    fg: '#8b949e',
    border: 'rgba(110,118,129,0.4)',
  },
  BLUE: {
    dot: '#4493f8',
    bg: 'rgba(56,139,253,0.1)',
    fg: '#388bfd',
    border: 'rgba(56,139,253,0.4)',
  },
  GREEN: {
    dot: '#3fb950',
    bg: 'rgba(46,160,67,0.15)',
    fg: '#3fb950',
    border: 'rgba(46,160,67,0.4)',
  },
  YELLOW: {
    dot: '#d29922',
    bg: 'rgba(187,128,9,0.15)',
    fg: '#d29922',
    border: 'rgba(187,128,9,0.4)',
  },
  ORANGE: {
    dot: '#db6d28',
    bg: 'rgba(219,109,40,0.1)',
    fg: '#db6d28',
    border: 'rgba(219,109,40,0.4)',
  },
  RED: {
    dot: '#f85149',
    bg: 'rgba(248,81,73,0.1)',
    fg: '#f85149',
    border: 'rgba(248,81,73,0.4)',
  },
  PINK: {
    dot: '#db61a2',
    bg: 'rgba(219,97,162,0.1)',
    fg: '#db61a2',
    border: 'rgba(219,97,162,0.4)',
  },
  PURPLE: {
    dot: '#a371f7',
    bg: 'rgba(163,113,247,0.1)',
    fg: '#a371f7',
    border: 'rgba(163,113,247,0.4)',
  },
};

export const colorFromEnum = (
  colorEnum: string | null | undefined,
): ConsoleColorPaletteEntry => {
  if (colorEnum === null || colorEnum === undefined) {
    return CONSOLE_COLOR_PALETTE.GRAY;
  }
  const normalized = colorEnum.toUpperCase();
  const known = (
    CONSOLE_COLOR_PALETTE as Record<string, ConsoleColorPaletteEntry>
  )[normalized];
  return known ?? CONSOLE_COLOR_PALETTE.GRAY;
};
