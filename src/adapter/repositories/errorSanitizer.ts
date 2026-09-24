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

export const sanitizeErrorForLogging = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (!hasRequestProperty(value)) {
    return value;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== null && typeof proto !== 'object') {
    return value;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
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
  return Object.create(proto, descriptors);
};
