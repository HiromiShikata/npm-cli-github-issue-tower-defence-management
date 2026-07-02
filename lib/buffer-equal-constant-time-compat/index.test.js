'use strict';
var bufferEq = require('./index');

describe('bufferEq', () => {
  it('should return true when both buffers have equal content', () => {
    var a = Buffer.from('hello');
    var b = Buffer.from('hello');
    expect(bufferEq(a, b)).toBe(true);
  });

  it('should return false when buffers have different content', () => {
    var a = Buffer.from('hello');
    var b = Buffer.from('world');
    expect(bufferEq(a, b)).toBe(false);
  });

  it('should return false when buffers have different lengths', () => {
    var a = Buffer.from('short');
    var b = Buffer.from('longer');
    expect(bufferEq(a, b)).toBe(false);
  });

  it('should return false when first argument is not a Buffer', () => {
    expect(bufferEq('hello', Buffer.from('hello'))).toBe(false);
  });

  it('should return false when second argument is not a Buffer', () => {
    expect(bufferEq(Buffer.from('hello'), 'hello')).toBe(false);
  });

  it('should return false when both arguments are not Buffers', () => {
    expect(bufferEq('hello', 'hello')).toBe(false);
  });

  it('should return false when first argument is null', () => {
    expect(bufferEq(null, Buffer.from('hello'))).toBe(false);
  });

  it('should return false when second argument is null', () => {
    expect(bufferEq(Buffer.from('hello'), null)).toBe(false);
  });

  describe('install', () => {
    it('should not throw when called', () => {
      expect(() => bufferEq.install()).not.toThrow();
    });
  });

  describe('restore', () => {
    it('should not throw when called', () => {
      expect(() => bufferEq.restore()).not.toThrow();
    });
  });
});
