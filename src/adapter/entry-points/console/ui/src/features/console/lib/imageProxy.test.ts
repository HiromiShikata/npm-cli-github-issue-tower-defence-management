import {
  buildImageProxyUrl,
  isProxyableImageUrl,
  rewriteGitHubImageSources,
} from './imageProxy';

describe('isProxyableImageUrl', () => {
  it('matches github user-attachments urls', () => {
    expect(
      isProxyableImageUrl(
        'https://github.com/user-attachments/assets/0a1b2c3d',
      ),
    ).toBe(true);
  });

  it('matches githubusercontent subdomain urls', () => {
    expect(
      isProxyableImageUrl(
        'https://private-user-images.githubusercontent.com/1/2.png',
      ),
    ).toBe(true);
  });

  it('does not match arbitrary external hosts', () => {
    expect(isProxyableImageUrl('https://example.com/avatar.png')).toBe(false);
  });
});

describe('buildImageProxyUrl', () => {
  it('encodes the source url and appends the token', () => {
    const src = 'https://github.com/user-attachments/assets/abc?x=1';
    expect(buildImageProxyUrl(src, 'tk')).toBe(
      `/api/img?url=${encodeURIComponent(src)}&k=tk`,
    );
  });

  it('omits the token when it is null', () => {
    const src = 'https://github.com/user-attachments/assets/abc';
    expect(buildImageProxyUrl(src, null)).toBe(
      `/api/img?url=${encodeURIComponent(src)}`,
    );
  });
});

describe('rewriteGitHubImageSources', () => {
  const buildProxyUrl = (src: string): string =>
    buildImageProxyUrl(src, 'console-token');

  it('rewrites an allow-listed github image src to the proxy url', () => {
    const githubSrc = 'https://github.com/user-attachments/assets/abc';
    const html = `<p><img src="${githubSrc}" alt="shot" /></p>`;
    const result = rewriteGitHubImageSources(html, buildProxyUrl);
    expect(result).toContain(`/api/img?url=${encodeURIComponent(githubSrc)}`);
    expect(result).toContain('k=console-token');
    expect(result).not.toContain(`src="${githubSrc}"`);
  });

  it('rewrites a githubusercontent image src to the proxy url', () => {
    const githubSrc =
      'https://private-user-images.githubusercontent.com/1/2.png';
    const html = `<img src="${githubSrc}" />`;
    const result = rewriteGitHubImageSources(html, buildProxyUrl);
    expect(result).toContain(`/api/img?url=${encodeURIComponent(githubSrc)}`);
  });

  it('leaves a non-matching image src unchanged', () => {
    const externalSrc = 'https://example.com/avatar.png';
    const html = `<img src="${externalSrc}" />`;
    const result = rewriteGitHubImageSources(html, buildProxyUrl);
    expect(result).toContain(`src="${externalSrc}"`);
    expect(result).not.toContain('/api/img');
  });

  it('returns the original html when there is no image to rewrite', () => {
    const html = '<p>no images here</p>';
    expect(rewriteGitHubImageSources(html, buildProxyUrl)).toBe(html);
  });
});
