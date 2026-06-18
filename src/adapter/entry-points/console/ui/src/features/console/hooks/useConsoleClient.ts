import { useMemo } from 'react';
import { createConsoleApiClient } from './consoleApiClient';
import { createConsoleItemCache } from './consoleItemCache';
import { useConsoleToken } from './useConsoleToken';

const readProjectCode = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  const projectCode = (window as { PJ_CODE?: unknown }).PJ_CODE;
  return typeof projectCode === 'string' ? projectCode : '';
};

export type ConsoleClient = {
  client: ReturnType<typeof createConsoleApiClient>;
  cache: ReturnType<typeof createConsoleItemCache>;
};

export const useConsoleClient = (): ConsoleClient => {
  const { appendToken } = useConsoleToken();
  return useMemo(() => {
    const client = createConsoleApiClient({
      pjcode: readProjectCode(),
      appendToken,
    });
    return { client, cache: createConsoleItemCache(client) };
  }, [appendToken]);
};
