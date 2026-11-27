const ALLOWED_IMAGE_URL =
  /^https:\/\/github\.com\/user-attachments\/|^https:\/\/[a-z0-9][a-z0-9.-]*\.githubusercontent\.com\//;

export const isProxyableImageUrl = (src: string): boolean =>
  ALLOWED_IMAGE_URL.test(src);

export type ImageProxyUrlBuilder = (src: string) => string;

export const buildImageProxyUrl = (src: string, itemUrl: string): string =>
  `/api/img?url=${encodeURIComponent(src)}&itemUrl=${encodeURIComponent(itemUrl)}`;

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

const DIRECTLY_LOADABLE_IMAGE_URL =
  /^https:\/\/(github\.com\/|[a-z0-9][a-z0-9.-]*\.githubusercontent\.com\/)/;
const SAME_ORIGIN_PROBE_BASE = 'https://same-origin.invalid/';

// Mirrors the console Content-Security-Policy `img-src` list: data image
// URLs, same-origin URLs, GitHub hosts over https, and the GitHub
// user-attachments URLs that the proxy serves. The source is resolved the way
// the browser resolves it, so `/\host/...` and `\\host/...` are judged as the
// cross-origin URLs they become.
export const isCspAllowedImageUrl = (src: string): boolean => {
  if (src.startsWith('data:image/')) {
    return true;
  }
  let resolved: URL;
  try {
    resolved = new URL(src, SAME_ORIGIN_PROBE_BASE);
  } catch {
    return false;
  }
  if (resolved.origin === new URL(SAME_ORIGIN_PROBE_BASE).origin) {
    return true;
  }
  return (
    DIRECTLY_LOADABLE_IMAGE_URL.test(resolved.href) ||
    isProxyableImageUrl(resolved.href)
  );
};

// Replaces every <img> whose source the console CSP would block with a link
// to the original URL, so the reader can still open the image.
export const replaceBlockedImagesWithLinks = (html: string): string => {
  if (typeof document === 'undefined') {
    return html;
  }
  const template = document.createElement('template');
  template.innerHTML = html;
  let replaced = false;
  template.content.querySelectorAll('img[src]').forEach((image) => {
    const src = image.getAttribute('src') ?? '';
    if (isCspAllowedImageUrl(src)) {
      return;
    }
    const link = document.createElement('a');
    link.setAttribute('href', src);
    link.textContent = image.getAttribute('alt') || src;
    image.replaceWith(link);
    replaced = true;
  });
  return replaced ? template.innerHTML : html;
};
