export const parsePjcodeFromPath = (pathname: string): string | null => {
  const segments = pathname.split('/').filter((segment) => segment.length > 0);
  if (segments.length < 2 || segments[0] !== 'projects') {
    return null;
  }
  const pjcode = segments[1];
  if (pjcode.length === 0) {
    return null;
  }
  return pjcode;
};

export const useConsolePjcode = (): string | null => {
  const pathname =
    typeof window === 'undefined' ? '' : window.location.pathname;
  return parsePjcodeFromPath(pathname);
};
