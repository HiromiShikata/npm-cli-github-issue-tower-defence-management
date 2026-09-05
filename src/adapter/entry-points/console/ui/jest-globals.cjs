// Plain CommonJS - runs before test framework so we can control load order.
// jsdom does not expose these Node 18+ globals; wire them up here.
const { TextDecoder, TextEncoder } = require('util');
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

const { ReadableStream, TextDecoderStream, TransformStream } = require('stream/web');
global.ReadableStream = ReadableStream;
global.TextDecoderStream = TextDecoderStream;
global.TransformStream = TransformStream;

// Minimal Response implementation sufficient for Cache API usage in tests.
// airplaneSnapshot.ts only calls: new Response(body, init), .json(), .text()
class MockResponse {
  constructor(body, _init) {
    this._body = typeof body === 'string' ? body : '';
  }
  async json() {
    return JSON.parse(this._body);
  }
  async text() {
    return this._body;
  }
}

global.Response = MockResponse;
