export const MERMAID_FRAME_PATH = '/mermaid-frame.html';

export type MermaidFrameRenderRequest = {
  type: 'render';
  requestId: number;
  code: string;
  fillWidth: boolean;
};

export type MermaidFrameResponse =
  | { type: 'size'; requestId: number; height: number }
  | { type: 'failed'; requestId: number; message: string };

export const createMermaidFrameRenderRequest = (
  requestId: number,
  code: string,
  fillWidth: boolean,
): MermaidFrameRenderRequest => ({
  type: 'render',
  requestId,
  code,
  fillWidth,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const parseMermaidFrameRequest = (
  data: unknown,
): MermaidFrameRenderRequest | null => {
  if (!isRecord(data)) {
    return null;
  }
  const { type, requestId, code, fillWidth } = data;
  if (
    type !== 'render' ||
    typeof requestId !== 'number' ||
    !Number.isInteger(requestId) ||
    typeof code !== 'string' ||
    typeof fillWidth !== 'boolean'
  ) {
    return null;
  }
  return { type, requestId, code, fillWidth };
};

export const parseMermaidFrameResponse = (
  data: unknown,
): MermaidFrameResponse | null => {
  if (!isRecord(data)) {
    return null;
  }
  const { type, requestId } = data;
  if (typeof requestId !== 'number' || !Number.isInteger(requestId)) {
    return null;
  }
  if (type === 'size') {
    const { height } = data;
    if (typeof height !== 'number' || !Number.isFinite(height) || height < 0) {
      return null;
    }
    return { type, requestId, height };
  }
  if (type === 'failed') {
    const { message } = data;
    if (typeof message !== 'string') {
      return null;
    }
    return { type, requestId, message };
  }
  return null;
};
