import { extractToken } from './proxyEntry';

describe('extractToken', () => {
  it('should return the token after a Bearer prefix', () => {
    expect(extractToken('Bearer sk-ant-token-123')).toBe('sk-ant-token-123');
  });

  it('should accept a lowercase bearer prefix', () => {
    expect(extractToken('bearer sk-ant-token-123')).toBe('sk-ant-token-123');
  });

  it('should accept a mixed-case Bearer prefix', () => {
    expect(extractToken('BeArEr sk-ant-token-123')).toBe('sk-ant-token-123');
  });

  it('should trim surrounding whitespace from the token', () => {
    expect(extractToken('Bearer   sk-ant-token-123   ')).toBe(
      'sk-ant-token-123',
    );
  });

  it('should pick the first value when authorization is an array', () => {
    expect(extractToken(['Bearer token-a', 'Bearer token-b'])).toBe('token-a');
  });

  it('should return null when authorization is undefined', () => {
    expect(extractToken(undefined)).toBeNull();
  });

  it('should return null when the prefix is missing', () => {
    expect(extractToken('Basic some-credential')).toBeNull();
  });

  it('should return null when only the prefix is provided', () => {
    expect(extractToken('Bearer ')).toBeNull();
  });

  it('should return null when the input is shorter than the prefix', () => {
    expect(extractToken('Bear')).toBeNull();
  });

  it('should run in linear time on adversarial whitespace input', () => {
    const adversarial = `bearer ${' '.repeat(50000)}`;
    const startedAt = Date.now();
    expect(extractToken(adversarial)).toBeNull();
    expect(Date.now() - startedAt).toBeLessThan(500);
  });
});
