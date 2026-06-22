export const nextPendingKeyAfter = (
  orderedKeys: string[],
  actedKey: string,
): string | null => {
  const actedIndex = orderedKeys.indexOf(actedKey);
  if (actedIndex < 0) {
    return orderedKeys.length > 0 ? orderedKeys[0] : null;
  }
  const nextIndex = actedIndex + 1;
  return nextIndex < orderedKeys.length ? orderedKeys[nextIndex] : null;
};

export const nextPendingKeyBrowse = (
  orderedKeys: string[],
  currentKey: string,
): string | null => {
  const index = orderedKeys.indexOf(currentKey);
  if (index < 0 || index >= orderedKeys.length - 1) {
    return null;
  }
  return orderedKeys[index + 1];
};

export const previousPendingKeyBefore = (
  orderedKeys: string[],
  currentKey: string,
): string | null => {
  const index = orderedKeys.indexOf(currentKey);
  if (index <= 0) {
    return null;
  }
  return orderedKeys[index - 1];
};
