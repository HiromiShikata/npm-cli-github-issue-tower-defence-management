const ALLOWED_IMAGE_URL =
  /^https:\/\/github\.com\/user-attachments\/|^https:\/\/[a-z0-9][a-z0-9.-]*\.githubusercontent\.com\//;

export const isProxyableImageUrl = (src: string): boolean =>
  ALLOWED_IMAGE_URL.test(src);

export type ImageProxyUrlBuilder = (src: string) => string;

export const buildImageProxyUrl = (src: string): string =>
  `/api/img?url=${encodeURIComponent(src)}`;

export const rewriteGitHubImageSources = (
  html: string,
  buildProxyUrl: ImageProxyUrlBuilder,
): string => {
  if (typeof document === 'undefined') {
    return html;
  }
  const template = document.createElement('template');
  template.innerHTML = html;
  const images = template.content.querySelectorAll('img[src]');
  let rewrote = false;
  images.forEach((image) => {
    const src = image.getAttribute('src') ?? '';
    if (isProxyableImageUrl(src)) {
      image.setAttribute('src', buildProxyUrl(src));
      rewrote = true;
    }
  });
  if (!rewrote) {
    return html;
  }
  return template.innerHTML;
};
