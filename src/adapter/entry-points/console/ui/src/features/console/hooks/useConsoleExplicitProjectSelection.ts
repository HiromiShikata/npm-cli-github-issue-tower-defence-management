import { useCallback, useEffect, useState } from 'react';

export const useConsoleExplicitProjectSelection = (
  pjcode: string | null,
): {
  explicitlySelectedPjcode: string | null;
  notifyExplicitSelection: (code: string) => void;
} => {
  const [explicitlySelectedPjcode, setExplicitlySelectedPjcode] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (
      explicitlySelectedPjcode !== null &&
      pjcode !== explicitlySelectedPjcode
    ) {
      setExplicitlySelectedPjcode(null);
    }
  }, [pjcode, explicitlySelectedPjcode]);

  const notifyExplicitSelection = useCallback((code: string) => {
    setExplicitlySelectedPjcode(code);
  }, []);

  return { explicitlySelectedPjcode, notifyExplicitSelection };
};
