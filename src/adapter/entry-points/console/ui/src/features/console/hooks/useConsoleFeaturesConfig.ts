import { useEffect, useState } from 'react';

export type ConsoleFeaturesConfig = {
  airplaneMode: boolean;
};

const FEATURES_PATH = '/api/features';

export const useConsoleFeaturesConfig = (): ConsoleFeaturesConfig => {
  const [config, setConfig] = useState<ConsoleFeaturesConfig>({
    airplaneMode: false,
  });

  useEffect(() => {
    fetch(FEATURES_PATH)
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const data: unknown = await response.json();
        if (
          data !== null &&
          typeof data === 'object' &&
          !Array.isArray(data) &&
          'airplaneMode' in data &&
          typeof (data as { airplaneMode: unknown }).airplaneMode === 'boolean'
        ) {
          setConfig({
            airplaneMode: (data as { airplaneMode: boolean }).airplaneMode,
          });
        }
      })
      .catch((err: unknown) => {
        console.warn('Failed to fetch /api/features', err);
      });
  }, []);

  return config;
};
