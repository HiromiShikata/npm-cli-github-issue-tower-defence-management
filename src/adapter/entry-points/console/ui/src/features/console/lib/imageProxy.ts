const ALLOWED_IMAGE_URL =
  /^https:\/\/github\.com\/user-attachments\/|^https:\/\/[a-z0-9][a-z0-9.-]*\.githubusercontent\.com\//;

// The URL parser lower-cases the host, so the host case of the source does not
// change which images the proxy serves.
export const isProxyableImageUrl = (src: string): boolean => {
  let canonical: string;
  try {
    canonical = new URL(src).href;
  } catch {
    return false;
  }
  return ALLOWED_IMAGE_URL.test(canonical);
};

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
const SAME_ORIGIN_PROBE_ORIGIN = 'https://same-origin.invalid';
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const AUTHORITY_PREFIX_PATTERN = /^[\\/]{2}/;

// A browser drops ASCII tab and newline characters and leading control or space
// characters before it parses a URL, so the checks run on the same form.
const ASCII_SPACE_OR_CONTROL_MAX_CODE = 0x20;
const ASCII_TAB_OR_NEWLINE_CODES: ReadonlySet<number> = new Set([
  0x09, 0x0a, 0x0d,
]);

const toBrowserParsableForm = (src: string): string => {
  const withoutTabsAndNewlines = Array.from(src)
    .filter((char) => !ASCII_TAB_OR_NEWLINE_CODES.has(char.charCodeAt(0)))
    .join('');
  let start = 0;
  while (
    start < withoutTabsAndNewlines.length &&
    withoutTabsAndNewlines.charCodeAt(start) <= ASCII_SPACE_OR_CONTROL_MAX_CODE
  ) {
    start += 1;
  }
  return withoutTabsAndNewlines.slice(start);
};

const isSchemeLessPathReference = (src: string): boolean => {
  const parsable = toBrowserParsableForm(src);
  return (
    !URL_SCHEME_PATTERN.test(parsable) &&
    !AUTHORITY_PREFIX_PATTERN.test(parsable)
  );
};

// Mirrors the console Content-Security-Policy `img-src` list: data image
// URLs, same-origin path references, GitHub hosts over https, and the GitHub
// user-attachments URLs that the proxy serves. A source is resolved the way the
// browser resolves it, so `/\host/...` and `\\host/...` are judged as the
// cross-origin URLs they become.
const isSameOriginOrGitHubUrl = (src: string): boolean => {
  let resolved: URL;
  try {
    resolved = new URL(src, SAME_ORIGIN_PROBE_BASE);
  } catch {
    return false;
  }
  if (
    isSchemeLessPathReference(src) &&
    resolved.origin === SAME_ORIGIN_PROBE_ORIGIN
  ) {
    return true;
  }
  return DIRECTLY_LOADABLE_IMAGE_URL.test(resolved.href);
};

export const isCspAllowedImageUrl = (src: string): boolean => {
  if (src.startsWith('data:image/')) {
    return true;
  }
  if (isSameOriginOrGitHubUrl(src)) {
    return true;
  }
  let resolved: URL;
  try {
    resolved = new URL(src, SAME_ORIGIN_PROBE_BASE);
  } catch {
    return false;
  }
  return isProxyableImageUrl(resolved.href);
};

export const isCspAllowedMediaUrl = (src: string): boolean =>
  src.startsWith('blob:') || isSameOriginOrGitHubUrl(src);

const replaceElementWithLink = (
  element: Element,
  href: string,
  text: string,
): void => {
  const link = element.ownerDocument.createElement('a');
  link.setAttribute('href', href);
  link.textContent = text;
  element.replaceWith(link);
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
    replaceElementWithLink(image, src, image.getAttribute('alt') || src);
    replaced = true;
  });
  return replaced ? template.innerHTML : html;
};

const mediaSourceOf = (video: Element): string | null => {
  const direct = video.getAttribute('src');
  if (direct !== null) {
    return direct;
  }
  const source = video.querySelector('source[src]');
  return source === null ? null : source.getAttribute('src');
};

export const replaceBlockedVideosWithLinks = (html: string): string => {
  if (typeof document === 'undefined') {
    return html;
  }
  const template = document.createElement('template');
  template.innerHTML = html;
  let replaced = false;
  template.content.querySelectorAll('video').forEach((video) => {
    const src = mediaSourceOf(video);
    if (src === null || isCspAllowedMediaUrl(src)) {
      return;
    }
    replaceElementWithLink(video, src, src);
    replaced = true;
  });
  return replaced ? template.innerHTML : html;
};

export const replaceBlockedMediaWithLinks = (html: string): string =>
  replaceBlockedVideosWithLinks(replaceBlockedImagesWithLinks(html));
