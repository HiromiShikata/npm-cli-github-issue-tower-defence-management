import { inspect } from 'util';
import { sanitizeErrorForLogging } from './errorSanitizer';

describe('sanitizeErrorForLogging', () => {
  describe('when the value passed to the logger carries a Request with an authorization header', () => {
    const makeRequestCarryingError = (
      token: string,
    ): Error & {
      request: Request;
    } => {
      const request = new Request('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
      });
      return Object.assign(
        new Error(`Request timed out: POST https://api.github.com/graphql`),
        { name: 'TimeoutError', request },
      );
    };

    it('does not include the bearer token in the util.inspect output of the sanitized error', () => {
      const token = 'ghp_superSecretToken123';
      const error = makeRequestCarryingError(token);

      const sanitized = sanitizeErrorForLogging(error);
      const output = inspect(sanitized, { depth: null });

      expect(output).not.toContain(token);
      expect(output).not.toContain('Bearer');
      expect(output).not.toContain('authorization');
    });

    it('does not include the bearer token in the util.inspect output when the Authorization header uses mixed case', () => {
      const token = 'ghp_anotherSecret456';
      const request = new Request('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const error = Object.assign(new Error('timeout'), {
        name: 'TimeoutError',
        request,
      });

      const sanitized = sanitizeErrorForLogging(error);
      const output = inspect(sanitized, { depth: null });

      expect(output).not.toContain(token);
    });

    it('preserves the error message and name in the sanitized output', () => {
      const error = makeRequestCarryingError('token-xyz');

      const sanitized = sanitizeErrorForLogging(error);

      expect(sanitized).toBeInstanceOf(Error);
      if (!(sanitized instanceof Error)) throw new Error('Expected Error');
      expect(sanitized.message).toBe(
        'Request timed out: POST https://api.github.com/graphql',
      );
      expect(sanitized.name).toBe('TimeoutError');
    });

    it('keeps the request url and method in the sanitized output for diagnostics', () => {
      const error = makeRequestCarryingError('token-xyz');

      const sanitized = sanitizeErrorForLogging(error);
      const output = inspect(sanitized, { depth: null });

      expect(output).toContain('https://api.github.com/graphql');
      expect(output).toContain('POST');
    });
  });

  describe('when the value passed to the logger is an HTTPError with options.headers containing an authorization header', () => {
    const makeHTTPErrorLike = (
      token: string,
    ): Error & { request: Request; options: { headers: Headers } } => {
      const request = new Request('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
      });
      const options = {
        method: 'POST' as const,
        headers: new Headers({
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        }),
      };
      return Object.assign(
        new Error(
          `Request failed with status code 401: POST https://api.github.com/graphql`,
        ),
        { name: 'HTTPError', request, options },
      );
    };

    it('does not include the bearer token from options.headers in the util.inspect output', () => {
      const token = 'ghp_restApiToken789';
      const error = makeHTTPErrorLike(token);

      const sanitized = sanitizeErrorForLogging(error);
      const output = inspect(sanitized, { depth: null });

      expect(output).not.toContain(token);
      expect(output).not.toContain('Bearer');
      expect(output).not.toContain('authorization');
    });

    it('preserves non-sensitive options fields like method in the sanitized output', () => {
      const error = makeHTTPErrorLike('ghp_token');

      const sanitized = sanitizeErrorForLogging(error);
      const output = inspect(sanitized, { depth: null });

      expect(output).toContain('POST');
    });

    it('does not include the bearer token from request.headers in the util.inspect output', () => {
      const token = 'ghp_restApiToken789';
      const error = makeHTTPErrorLike(token);

      const sanitized = sanitizeErrorForLogging(error);
      const output = inspect(sanitized, { depth: null });

      expect(output).not.toContain(token);
    });
  });

  describe('when the value does not carry an authorization header', () => {
    it('returns the original Error instance unchanged when it has no request property', () => {
      const error = new Error('generic network error');

      const result = sanitizeErrorForLogging(error);

      expect(result).toBe(error);
    });

    it('returns null unchanged', () => {
      expect(sanitizeErrorForLogging(null)).toBeNull();
    });

    it('returns a string unchanged', () => {
      const value = 'error string';
      expect(sanitizeErrorForLogging(value)).toBe(value);
    });

    it('returns a number unchanged', () => {
      expect(sanitizeErrorForLogging(404)).toBe(404);
    });

    it('returns undefined unchanged', () => {
      expect(sanitizeErrorForLogging(undefined)).toBeUndefined();
    });
  });
});
