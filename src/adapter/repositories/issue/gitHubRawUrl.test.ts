import { normalizeGitHubRawUrl } from './gitHubRawUrl';

describe('normalizeGitHubRawUrl', () => {
  it('rewrites a pull request file raw url onto the raw content host', () => {
    expect(
      normalizeGitHubRawUrl(
        'https://github.com/HiromiShikata/blog-beauty-aesthetics-review/raw/4ab5e84486d29/content/posts/img/20260707/before.jpg',
      ),
    ).toBe(
      'https://raw.githubusercontent.com/HiromiShikata/blog-beauty-aesthetics-review/4ab5e84486d29/content/posts/img/20260707/before.jpg',
    );
  });

  it('keeps a url that already points at the raw content host', () => {
    expect(
      normalizeGitHubRawUrl(
        'https://raw.githubusercontent.com/owner/repo/sha/path/image.png',
      ),
    ).toBe('https://raw.githubusercontent.com/owner/repo/sha/path/image.png');
  });

  it('returns null for a url that is not a github raw url', () => {
    expect(normalizeGitHubRawUrl('https://example.com/image.png')).toBeNull();
    expect(
      normalizeGitHubRawUrl('https://github.com/owner/repo/blob/sha/image.png'),
    ).toBeNull();
    expect(normalizeGitHubRawUrl('')).toBeNull();
  });
});
