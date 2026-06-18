import { useCallback, useEffect, useState } from 'react';

const CONSOLE_TOKEN_STORAGE_KEY = 'tdpm-console-token';

const readTokenFromLocation = (search: string): string | null => {
  const params = new URLSearchParams(search);
  const tokenFromQuery = params.get('k');
  if (tokenFromQuery !== null && tokenFromQuery !== '') {
    return tokenFromQuery;
  }
  return null;
};

const readPersistedToken = (): string | null => {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const persisted = localStorage.getItem(CONSOLE_TOKEN_STORAGE_KEY);
  return persisted !== null && persisted !== '' ? persisted : null;
};

export type ConsoleTokenState = {
  token: string | null;
  appendToken: (dataUrl: string) => string;
};

export const useConsoleToken = (): ConsoleTokenState => {
  const [token, setToken] = useState<string | null>(() => {
    const search = typeof window === 'undefined' ? '' : window.location.search;
    return readTokenFromLocation(search) ?? readPersistedToken();
  });

  useEffect(() => {
    if (token === null) {
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONSOLE_TOKEN_STORAGE_KEY, token);
    }
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const tokenFromQuery = readTokenFromLocation(window.location.search);
    if (tokenFromQuery !== null) {
      setToken(tokenFromQuery);
    }
  }, []);

  const appendToken = useCallback(
    (dataUrl: string): string => {
      if (token === null) {
        return dataUrl;
      }
      const separator = dataUrl.includes('?') ? '&' : '?';
      return `${dataUrl}${separator}k=${encodeURIComponent(token)}`;
    },
    [token],
  );

  return { token, appendToken };
};
