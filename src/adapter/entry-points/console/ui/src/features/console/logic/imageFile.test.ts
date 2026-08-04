import { isImageFilePath } from './imageFile';

describe('isImageFilePath', () => {
  it('recognises the image extensions used in repository content', () => {
    expect(isImageFilePath('content/posts/img/20260707/before.jpg')).toBe(true);
    expect(isImageFilePath('docs/screenshot.PNG')).toBe(true);
    expect(isImageFilePath('assets/logo.svg')).toBe(true);
    expect(isImageFilePath('assets/photo.jpeg')).toBe(true);
    expect(isImageFilePath('assets/animation.gif')).toBe(true);
    expect(isImageFilePath('assets/picture.webp')).toBe(true);
  });

  it('rejects paths that are not images', () => {
    expect(isImageFilePath('src/index.ts')).toBe(false);
    expect(isImageFilePath('README.md')).toBe(false);
    expect(isImageFilePath('')).toBe(false);
  });
});
