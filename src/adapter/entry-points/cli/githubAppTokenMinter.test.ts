import {
  mintReadOnlyTokensFromKeyPaths,
  mintTokenFromKeyPath,
} from './githubAppTokenMinter';

describe('mintTokenFromKeyPath', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('returns null when key file does not exist', async () => {
    const result = await mintTokenFromKeyPath(
      '/nonexistent/path/missing-private-key.pem',
      'HiromiShikata',
    );
    expect(result).toBeNull();
  });

  it('logs an error when key file does not exist', async () => {
    await mintTokenFromKeyPath(
      '/nonexistent/path/missing-private-key.pem',
      'HiromiShikata',
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain(
      '[githubAppTokenMinter] failed to mint token from /nonexistent/path/missing-private-key.pem:',
    );
    expect(errorSpy.mock.calls[0][1]).toHaveProperty('code', 'ENOENT');
  });
});

describe('mintReadOnlyTokensFromKeyPaths', () => {
  it('returns empty array when key file is missing', async () => {
    const result = await mintReadOnlyTokensFromKeyPaths([
      '/nonexistent/missing-private-key.pem',
    ]);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty key paths', async () => {
    const result = await mintReadOnlyTokensFromKeyPaths([]);
    expect(result).toEqual([]);
  });

  it('skips first path returning null and returns token from second path', async () => {
    const mintFn = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('minted-token-from-second-key');

    const result = await mintReadOnlyTokensFromKeyPaths(
      ['/path/key1-private-key.pem', '/path/key2-private-key.pem'],
      'HiromiShikata',
      mintFn,
    );

    expect(result).toEqual(['minted-token-from-second-key']);
    expect(mintFn).toHaveBeenCalledTimes(2);
    expect(mintFn).toHaveBeenNthCalledWith(
      1,
      '/path/key1-private-key.pem',
      'HiromiShikata',
    );
    expect(mintFn).toHaveBeenNthCalledWith(
      2,
      '/path/key2-private-key.pem',
      'HiromiShikata',
    );
  });

  it('returns empty array when all key paths yield null', async () => {
    const mintFn = jest.fn().mockResolvedValue(null);
    const result = await mintReadOnlyTokensFromKeyPaths(
      ['/path/key1-private-key.pem', '/path/key2-private-key.pem'],
      'HiromiShikata',
      mintFn,
    );
    expect(result).toEqual([]);
  });

  it('collects tokens from all key paths that succeed', async () => {
    const mintFn = jest
      .fn()
      .mockResolvedValueOnce('token-from-key1')
      .mockResolvedValueOnce('token-from-key2');

    const result = await mintReadOnlyTokensFromKeyPaths(
      ['/path/key1-private-key.pem', '/path/key2-private-key.pem'],
      'HiromiShikata',
      mintFn,
    );

    expect(result).toEqual(['token-from-key1', 'token-from-key2']);
  });
});
