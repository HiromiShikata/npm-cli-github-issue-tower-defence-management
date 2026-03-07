export const encodeForURI = (url?: string | null): string => {
  if (!url) {
    return '';
  }
  return encodeURI(url).replace('#', '%23').replace('&', '%26');
};
