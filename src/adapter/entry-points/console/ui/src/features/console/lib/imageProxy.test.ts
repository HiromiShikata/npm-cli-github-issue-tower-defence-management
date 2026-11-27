import {
  buildImageProxyUrl,
  isCspAllowedImageUrl,
  isCspAllowedMediaUrl,
  isProxyableImageUrl,
  replaceBlockedImagesWithLinks,
  replaceBlockedMediaWithLinks,
  rewriteGitHubImageSources,
} from './imageProxy';

const itemUrl = 'https://github.com/example-owner/example-repo/issues/1';

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
  it('encodes the source url and the item url without appending a token', () => {
    const src = 'https://github.com/user-attachments/assets/abc?x=1';
    expect(buildImageProxyUrl(src, itemUrl)).toBe(
      `/api/img?url=${encodeURIComponent(src)}&itemUrl=${encodeURIComponent(itemUrl)}`,
    );
  });

  it('does not include a token query parameter', () => {
    const src = 'https://github.com/user-attachments/assets/abc';
    expect(buildImageProxyUrl(src, itemUrl)).not.toContain('k=');
  });
});

describe('rewriteGitHubImageSources', () => {
  const buildProxyUrl = (src: string): string =>
    buildImageProxyUrl(src, itemUrl);

  it('rewrites an allow-listed github image src to the proxy url', () => {
    const githubSrc = 'https://github.com/user-attachments/assets/abc';
    const html = `<p><img src="${githubSrc}" alt="shot" /></p>`;
    const result = rewriteGitHubImageSources(html, buildProxyUrl);
    expect(result).toContain(`/api/img?url=${encodeURIComponent(githubSrc)}`);
    expect(result).not.toContain('k=');
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

describe('isCspAllowedImageUrl', () => {
  it.each([
    'data:image/png;base64,AAAA',
    '/relative/image.png',
    'image.png',
    'https://github.com/user-attachments/assets/abc',
    'https://private-user-images.githubusercontent.com/1/2.png',
    'https://github.com/owner/repo/raw/main/a.png',
    'https://GitHub.com/user-attachments/assets/abc',
  ])('allows %s', (src) => {
    expect(isCspAllowedImageUrl(src)).toBe(true);
  });

  it.each([
    'https://example.com/avatar.png',
    'http://github.com/owner/repo/raw/main/a.png',
    'http://example.com/a.png',
    '//example.com/a.png',
    'https://githubusercontent.com.evil.example/a.png',
    '/\\example.com/a.png',
    '\\\\example.com/a.png',
    '/\\\\example.com/a.png',
    'https://same-origin.invalid/a.png',
    '//same-origin.invalid/a.png',
    '/\\same-origin.invalid/a.png',
    '\t//same-origin.invalid/a.png',
  ])('blocks %s', (src) => {
    expect(isCspAllowedImageUrl(src)).toBe(false);
  });
});

describe('replaceBlockedImagesWithLinks', () => {
  it('replaces a non-allowed image with a link to its original url', () => {
    const externalSrc = 'https://example.com/shot.png';
    const result = replaceBlockedImagesWithLinks(
      `<p><img src="${externalSrc}" alt="shot" /></p>`,
    );
    expect(result).not.toContain('<img');
    expect(result).toContain(`<a href="${externalSrc}">shot</a>`);
  });

  it('uses the url as link text when the image has no alt text', () => {
    const externalSrc = 'https://example.com/shot.png';
    const result = replaceBlockedImagesWithLinks(
      `<img src="${externalSrc}" />`,
    );
    expect(result).toContain(`<a href="${externalSrc}">${externalSrc}</a>`);
  });

  it('keeps allowed images untouched', () => {
    const githubSrc = 'https://github.com/user-attachments/assets/abc';
    const html = `<img src="${githubSrc}" alt="x" />`;
    expect(replaceBlockedImagesWithLinks(html)).toBe(html);
  });

  it('returns the original html when no image is blocked', () => {
    const html = '<p>plain</p>';
    expect(replaceBlockedImagesWithLinks(html)).toBe(html);
  });
});

describe('isProxyableImageUrl host case', () => {
  it('accepts a GitHub user-attachments URL whose host is written in upper case', () => {
    expect(
      isProxyableImageUrl('https://GitHub.com/user-attachments/assets/abc'),
    ).toBe(true);
  });
});

describe('isCspAllowedMediaUrl', () => {
  it.each([
    '/relative/video.mp4',
    'video.mp4',
    'https://github.com/user-attachments/assets/abc',
    'https://private-user-images.githubusercontent.com/1/2.mp4',
    'https://GitHub.com/user-attachments/assets/abc',
    'blob:https://github.com/0b1f1c3e-0000-4000-8000-000000000000',
  ])('allows %s', (src) => {
    expect(isCspAllowedMediaUrl(src)).toBe(true);
  });

  it.each([
    'https://example.com/demo.mp4',
    'http://github.com/owner/repo/raw/main/demo.mp4',
    '//example.com/demo.mp4',
    'https://githubusercontent.com.evil.example/demo.mp4',
    '/\\example.com/demo.mp4',
    'https://same-origin.invalid/demo.mp4',
  ])('blocks %s', (src) => {
    expect(isCspAllowedMediaUrl(src)).toBe(false);
  });
});

describe('replaceBlockedMediaWithLinks', () => {
  it('replaces a video on a non-GitHub host with a link to its original url', () => {
    const externalSrc = 'https://example.com/demo.mp4';
    const result = replaceBlockedMediaWithLinks(
      `<video src="${externalSrc}" controls></video>`,
    );
    expect(result).not.toContain('<video');
    expect(result).toContain(`<a href="${externalSrc}">${externalSrc}</a>`);
  });

  it('replaces a video whose source is a child source element', () => {
    const externalSrc = 'https://example.com/demo.webm';
    const result = replaceBlockedMediaWithLinks(
      `<video controls><source src="${externalSrc}" type="video/webm"></video>`,
    );
    expect(result).not.toContain('<video');
    expect(result).toContain(`<a href="${externalSrc}">${externalSrc}</a>`);
  });

  it('keeps a video on a GitHub host playable', () => {
    const githubSrc = 'https://github.com/user-attachments/assets/abc';
    const html = `<video src="${githubSrc}" controls></video>`;
    expect(replaceBlockedMediaWithLinks(html)).toBe(html);
  });

  it('still replaces a blocked image as before', () => {
    const externalSrc = 'https://example.com/shot.png';
    const result = replaceBlockedMediaWithLinks(
      `<img src="${externalSrc}" alt="shot" />`,
    );
    expect(result).toContain(`<a href="${externalSrc}">shot</a>`);
  });

  it('returns the original html when no media is blocked', () => {
    const html = '<p>plain</p>';
    expect(replaceBlockedMediaWithLinks(html)).toBe(html);
  });
});

describe('replaceBlockedMediaWithLinks poster', () => {
  it('drops a video poster that the console CSP would block', () => {
    const result = replaceBlockedMediaWithLinks(
      '<video src="https://github.com/user-attachments/assets/abc" poster="https://example.com/poster.png" controls></video>',
    );
    expect(result).toContain('<video');
    expect(result).not.toContain('poster.png');
    expect(result).toContain(
      'src="https://github.com/user-attachments/assets/abc"',
    );
  });

  it('keeps a video poster hosted on GitHub', () => {
    const html =
      '<video src="https://github.com/user-attachments/assets/abc" poster="https://github.com/user-attachments/assets/poster"></video>';
    expect(replaceBlockedMediaWithLinks(html)).toBe(html);
  });
});
