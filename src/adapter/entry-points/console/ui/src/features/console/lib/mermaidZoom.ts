export const MERMAID_ZOOM_MIN_SCALE = 1;
export const MERMAID_ZOOM_MAX_SCALE = 6;
export const MERMAID_ZOOM_SCALE_STEP = 0.5;

export const clampMermaidZoomScale = (scale: number): number => {
  if (Number.isNaN(scale)) {
    return MERMAID_ZOOM_MIN_SCALE;
  }
  if (scale < MERMAID_ZOOM_MIN_SCALE) {
    return MERMAID_ZOOM_MIN_SCALE;
  }
  if (scale > MERMAID_ZOOM_MAX_SCALE) {
    return MERMAID_ZOOM_MAX_SCALE;
  }
  return scale;
};

export const mermaidZoomScaleIn = (scale: number): number =>
  clampMermaidZoomScale(clampMermaidZoomScale(scale) + MERMAID_ZOOM_SCALE_STEP);

export const mermaidZoomScaleOut = (scale: number): number =>
  clampMermaidZoomScale(clampMermaidZoomScale(scale) - MERMAID_ZOOM_SCALE_STEP);

export const isMermaidZoomScaleAtMinimum = (scale: number): boolean =>
  clampMermaidZoomScale(scale) <= MERMAID_ZOOM_MIN_SCALE;

export const isMermaidZoomScaleAtMaximum = (scale: number): boolean =>
  clampMermaidZoomScale(scale) >= MERMAID_ZOOM_MAX_SCALE;

export const formatMermaidZoomScale = (scale: number): string =>
  `${Math.round(clampMermaidZoomScale(scale) * 100)}%`;

export const mermaidZoomCanvasWidth = (scale: number): string =>
  `${clampMermaidZoomScale(scale) * 100}%`;
