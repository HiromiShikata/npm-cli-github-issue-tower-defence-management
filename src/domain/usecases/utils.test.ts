import { encodeForURI } from './utils';

describe('encodeForURI', () => {
  it('should return empty string when url is undefined', () => {
    expect(encodeForURI(undefined)).toBe('');
  });

  it('should return empty string when url is null', () => {
    expect(encodeForURI(null)).toBe('');
  });

  it('should return empty string when url is empty', () => {
    expect(encodeForURI('')).toBe('');
  });

  it('should encode a single # character', () => {
    expect(encodeForURI('foo#bar')).toBe('foo%23bar');
  });

  it('should encode all occurrences of # in the input', () => {
    expect(encodeForURI('foo#bar#baz#qux')).toBe('foo%23bar%23baz%23qux');
  });

  it('should encode a single & character', () => {
    expect(encodeForURI('foo&bar')).toBe('foo%26bar');
  });

  it('should encode all occurrences of & in the input', () => {
    expect(encodeForURI('foo&bar&baz&qux')).toBe('foo%26bar%26baz%26qux');
  });

  it('should encode all occurrences of both # and & together', () => {
    expect(encodeForURI('a#b&c#d&e')).toBe('a%23b%26c%23d%26e');
  });
});
