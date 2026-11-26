import {
  type ImageFetcher,
  fetchProxiedImage,
  isAllowedImageUrl,
} from './consoleImageProxy';

describe('isAllowedImageUrl', () => {
  it('allows github user-attachments URLs', () => {
    expect(
      isAllowedImageUrl(
        'https://github.com/user-attachments/assets/0a1b2c3d-4e5f',
      ),
    ).toBe(true);
  });

  it('allows githubusercontent subdomain URLs', () => {
    expect(
      isAllowedImageUrl(
        'https://private-user-images.githubusercontent.com/1/2.png',
      ),
    ).toBe(true);
  });

  it('rejects arbitrary external hosts', () => {
    expect(isAllowedImageUrl('https://example.com/avatar.png')).toBe(false);
  });

  it('rejects non-https github paths outside user-attachments', () => {
    expect(isAllowedImageUrl('https://github.com/HiromiShikata/repo')).toBe(
      false,
    );
  });

  it('rejects a host that merely contains githubusercontent.com as a suffix trick', () => {
    expect(isAllowedImageUrl('https://evil-githubusercontent.com/x.png')).toBe(
      false,
    );
  });
});

describe('fetchProxiedImage', () => {
  const successFetcher: ImageFetcher = async (_url, headers) => {
    expect(headers.Authorization).toBe('token gh-token-value');
    return {
      status: 200,
      contentType: 'image/png',
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    };
  };

  it('returns image bytes for an allow-listed url with a valid token', async () => {
    const result = await fetchProxiedImage(
      'https://github.com/user-attachments/assets/abc',
      'gh-token-value',
      successFetcher,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contentType).toBe('image/png');
      expect(Array.from(result.body)).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
  });

  it('rejects a missing url with status 400', async () => {
    const result = await fetchProxiedImage(
      '',
      'gh-token-value',
      successFetcher,
    );
    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      error: 'missing url parameter',
    });
  });

  it('rejects a non-allow-listed url with status 400', async () => {
    const result = await fetchProxiedImage(
      'https://example.com/avatar.png',
      'gh-token-value',
      successFetcher,
    );
    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      error: 'url not in allowed domain',
    });
  });

  it('returns 502 when the upstream responds with a non-2xx status', async () => {
    const failingFetcher: ImageFetcher = async () => ({
      status: 404,
      contentType: null,
      body: Buffer.alloc(0),
    });
    const result = await fetchProxiedImage(
      'https://github.com/user-attachments/assets/abc',
      'gh-token-value',
      failingFetcher,
    );
    expect(result).toEqual({
      ok: false,
      statusCode: 502,
      error: 'upstream 404',
    });
  });

  it('returns 502 when the fetcher throws', async () => {
    const throwingFetcher: ImageFetcher = async () => {
      throw new Error('network down');
    };
    const result = await fetchProxiedImage(
      'https://github.com/user-attachments/assets/abc',
      'gh-token-value',
      throwingFetcher,
    );
    expect(result).toEqual({
      ok: false,
      statusCode: 502,
      error: 'proxy error: network down',
    });
  });

  it('falls back to octet-stream content type when upstream omits it', async () => {
    const noContentTypeFetcher: ImageFetcher = async () => ({
      status: 200,
      contentType: null,
      body: Buffer.from([0x01]),
    });
    const result = await fetchProxiedImage(
      'https://private-user-images.githubusercontent.com/1/2',
      'gh-token-value',
      noContentTypeFetcher,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contentType).toBe('application/octet-stream');
    }
  });
});
