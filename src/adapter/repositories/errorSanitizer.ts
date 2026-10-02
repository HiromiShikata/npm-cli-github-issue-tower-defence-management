import { redactSecrets } from '../../domain/services/secretRedaction';

const sanitizeRequest = (request: unknown): unknown => {
  if (!(request instanceof Request)) {
    return request;
  }
  return {
    url: request.url,
    method: request.method,
  };
};

type ObjectWithHeaders = object & { headers: unknown };

const hasHeadersProperty = (value: object): value is ObjectWithHeaders =>
  'headers' in value;

const sanitizeOptions = (options: unknown): unknown => {
  if (typeof options !== 'object' || options === null) {
    return options;
  }
  if (!hasHeadersProperty(options)) {
    return options;
  }
  if (!(options.headers instanceof Headers)) {
    return options;
  }
  return Object.assign({}, options, { headers: new Headers() });
};

type ObjectWithRequest = object & { request: unknown };

const hasRequestProperty = (value: object): value is ObjectWithRequest =>
  'request' in value;

type ObjectWithMessage = object & { message: unknown };
const hasMessageProperty = (value: object): value is ObjectWithMessage =>
  'message' in value;

type ObjectWithStack = object & { stack: unknown };
const hasStackProperty = (value: object): value is ObjectWithStack =>
  'stack' in value;

export const sanitizeErrorForLogging = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  const hasRequest = hasRequestProperty(value);
  const originalMessage =
    hasMessageProperty(value) && typeof value.message === 'string'
      ? value.message
      : null;
  const redactedMessage =
    originalMessage !== null ? redactSecrets(originalMessage) : null;
  const messageChanged =
    originalMessage !== null && redactedMessage !== originalMessage;
  const originalStack =
    hasStackProperty(value) && typeof value.stack === 'string'
      ? value.stack
      : null;
  const redactedStack =
    originalStack !== null ? redactSecrets(originalStack) : null;
  const stackChanged =
    originalStack !== null && redactedStack !== originalStack;
  if (!hasRequest && !messageChanged && !stackChanged) {
    return value;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== null && typeof proto !== 'object') {
    return value;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (hasRequest) {
    descriptors['request'] = {
      value: sanitizeRequest(value.request),
      configurable: true,
      enumerable: true,
      writable: true,
    };
    if ('options' in value) {
      descriptors['options'] = {
        value: sanitizeOptions(value.options),
        configurable: true,
        enumerable: true,
        writable: true,
      };
    }
  }
  if (messageChanged) {
    descriptors['message'] = {
      value: redactedMessage,
      configurable: true,
      enumerable: true,
      writable: true,
    };
  }
  if (stackChanged) {
    descriptors['stack'] = {
      value: redactedStack,
      configurable: true,
      enumerable: true,
      writable: true,
    };
  }
  return Object.create(proto, descriptors);
};
