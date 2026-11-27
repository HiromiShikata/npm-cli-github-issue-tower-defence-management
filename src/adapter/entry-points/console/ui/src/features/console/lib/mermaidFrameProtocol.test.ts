import {
  createMermaidFrameRenderRequest,
  MERMAID_FRAME_PATH,
  parseMermaidFrameRequest,
  parseMermaidFrameResponse,
} from './mermaidFrameProtocol';

describe('mermaid frame protocol', () => {
  it('serves the frame from a fixed console path', () => {
    expect(MERMAID_FRAME_PATH).toBe('/mermaid-frame.html');
  });

  it('builds a render request carrying the id, code and width mode', () => {
    expect(
      createMermaidFrameRenderRequest(3, 'graph TD; A-->B;', true),
    ).toEqual({
      type: 'render',
      requestId: 3,
      code: 'graph TD; A-->B;',
      fillWidth: true,
    });
  });

  it.each([
    [
      'a well-formed render request',
      { type: 'render', requestId: 1, code: 'graph TD;', fillWidth: false },
      { type: 'render', requestId: 1, code: 'graph TD;', fillWidth: false },
    ],
    ['null', null, null],
    ['a string', 'render', null],
    [
      'an unknown message type',
      { type: 'eval', requestId: 1, code: 'x', fillWidth: false },
      null,
    ],
    [
      'a request id that is not an integer',
      { type: 'render', requestId: 1.5, code: 'x', fillWidth: false },
      null,
    ],
    [
      'a missing code',
      { type: 'render', requestId: 1, fillWidth: false },
      null,
    ],
    [
      'a non-boolean width mode',
      { type: 'render', requestId: 1, code: 'x', fillWidth: 'yes' },
      null,
    ],
  ])('parses a render request from %s', (_label, input, expected) => {
    expect(parseMermaidFrameRequest(input)).toEqual(expected);
  });

  it.each([
    [
      'a size report',
      { type: 'size', requestId: 2, height: 420 },
      { type: 'size', requestId: 2, height: 420 },
    ],
    [
      'a failure report',
      { type: 'failed', requestId: 2, message: 'parse error' },
      { type: 'failed', requestId: 2, message: 'parse error' },
    ],
    [
      'a size report with a negative height',
      { type: 'size', requestId: 2, height: -1 },
      null,
    ],
    [
      'a failure report without a message',
      { type: 'failed', requestId: 2 },
      null,
    ],
    ['undefined', undefined, null],
  ])('parses a response from %s', (_label, input, expected) => {
    expect(parseMermaidFrameResponse(input)).toEqual(expected);
  });
});
