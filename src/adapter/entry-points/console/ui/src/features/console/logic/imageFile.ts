const IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.avif',
  '.bmp',
  '.ico',
];

export const isImageFilePath = (path: string): boolean => {
  const lowered = path.toLowerCase();
  return IMAGE_EXTENSIONS.some((extension) => lowered.endsWith(extension));
};
