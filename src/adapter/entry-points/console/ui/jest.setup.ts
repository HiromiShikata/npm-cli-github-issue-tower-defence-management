import { TextDecoder, TextEncoder } from 'node:util';
import {
  ReadableStream,
  TransformStream,
  WritableStream,
} from 'node:stream/web';
import { MessageChannel, MessagePort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';

const globalScope = globalThis as Record<string, unknown>;

const ensureGlobal = (name: string, value: unknown): void => {
  if (typeof globalScope[name] === 'undefined') {
    globalScope[name] = value;
  }
};

ensureGlobal('TextEncoder', TextEncoder);
ensureGlobal('TextDecoder', TextDecoder);
ensureGlobal('ReadableStream', ReadableStream);
ensureGlobal('WritableStream', WritableStream);
ensureGlobal('TransformStream', TransformStream);
ensureGlobal('MessageChannel', MessageChannel);
ensureGlobal('MessagePort', MessagePort);
ensureGlobal('performance', performance);

require('@testing-library/jest-dom');

const undici = require('undici') as {
  fetch: typeof fetch;
  Headers: typeof Headers;
  Request: typeof Request;
  Response: typeof Response;
};

ensureGlobal('fetch', undici.fetch);
ensureGlobal('Headers', undici.Headers);
ensureGlobal('Request', undici.Request);
ensureGlobal('Response', undici.Response);
