export const encodeForURI = (url?: string | null): string => {
  if (!url) {
    return '';
  }
  return encodeURI(url).replace(/#/g, '%23').replace(/&/g, '%26');
};
