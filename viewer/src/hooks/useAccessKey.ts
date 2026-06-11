import { useState, useEffect } from 'react';

export const useAccessKey = (): {
  accessKey: string | null;
  setAccessKey: (key: string) => void;
} => {
  const [accessKey, setAccessKeyState] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const keyFromUrl = params.get('accessKey');
    if (keyFromUrl) {
      sessionStorage.setItem('accessKey', keyFromUrl);
      const newUrl = window.location.pathname;
      window.history.replaceState(null, '', newUrl);
      return keyFromUrl;
    }
    return sessionStorage.getItem('accessKey');
  });

  useEffect(() => {
    if (accessKey) {
      sessionStorage.setItem('accessKey', accessKey);
    }
  }, [accessKey]);

  const setAccessKey = (key: string): void => {
    sessionStorage.setItem('accessKey', key);
    setAccessKeyState(key);
  };

  return { accessKey, setAccessKey };
};
