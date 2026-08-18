import {
  clampMermaidZoomScale,
  formatMermaidZoomScale,
  isMermaidZoomScaleAtMaximum,
  isMermaidZoomScaleAtMinimum,
  MERMAID_ZOOM_MAX_SCALE,
  MERMAID_ZOOM_MIN_SCALE,
  MERMAID_ZOOM_SCALE_STEP,
  mermaidZoomCanvasWidth,
  mermaidZoomScaleIn,
  mermaidZoomScaleOut,
} from './mermaidZoom';

describe('clampMermaidZoomScale', () => {
  it('keeps a scale inside the range untouched', () => {
    expect(clampMermaidZoomScale(2.5)).toBe(2.5);
  });

  it('raises a scale below the minimum to the minimum', () => {
    expect(clampMermaidZoomScale(0.2)).toBe(MERMAID_ZOOM_MIN_SCALE);
  });

  it('lowers a scale above the maximum to the maximum', () => {
    expect(clampMermaidZoomScale(12)).toBe(MERMAID_ZOOM_MAX_SCALE);
  });

  it('falls back to the minimum for a value that is not a number', () => {
    expect(clampMermaidZoomScale(Number.NaN)).toBe(MERMAID_ZOOM_MIN_SCALE);
  });
});

describe('mermaidZoomScaleIn', () => {
  it('adds one step', () => {
    expect(mermaidZoomScaleIn(MERMAID_ZOOM_MIN_SCALE)).toBe(
      MERMAID_ZOOM_MIN_SCALE + MERMAID_ZOOM_SCALE_STEP,
    );
  });

  it('stops at the maximum', () => {
    expect(mermaidZoomScaleIn(MERMAID_ZOOM_MAX_SCALE)).toBe(
      MERMAID_ZOOM_MAX_SCALE,
    );
  });
});

describe('mermaidZoomScaleOut', () => {
  it('subtracts one step', () => {
    expect(mermaidZoomScaleOut(3)).toBe(3 - MERMAID_ZOOM_SCALE_STEP);
  });

  it('stops at the minimum', () => {
    expect(mermaidZoomScaleOut(MERMAID_ZOOM_MIN_SCALE)).toBe(
      MERMAID_ZOOM_MIN_SCALE,
    );
  });
});

describe('zoom boundary reporting', () => {
  it('reports the minimum boundary', () => {
    expect(isMermaidZoomScaleAtMinimum(MERMAID_ZOOM_MIN_SCALE)).toBe(true);
    expect(isMermaidZoomScaleAtMinimum(MERMAID_ZOOM_MIN_SCALE + 0.5)).toBe(
      false,
    );
  });

  it('reports the maximum boundary', () => {
    expect(isMermaidZoomScaleAtMaximum(MERMAID_ZOOM_MAX_SCALE)).toBe(true);
    expect(isMermaidZoomScaleAtMaximum(MERMAID_ZOOM_MAX_SCALE - 0.5)).toBe(
      false,
    );
  });
});

describe('presentation helpers', () => {
  it('formats the scale as a percentage', () => {
    expect(formatMermaidZoomScale(1)).toBe('100%');
    expect(formatMermaidZoomScale(2.5)).toBe('250%');
  });

  it('derives the canvas width from the scale', () => {
    expect(mermaidZoomCanvasWidth(1)).toBe('100%');
    expect(mermaidZoomCanvasWidth(3)).toBe('300%');
  });

  it('derives the canvas width from a clamped scale', () => {
    expect(mermaidZoomCanvasWidth(99)).toBe(`${MERMAID_ZOOM_MAX_SCALE * 100}%`);
  });
});
