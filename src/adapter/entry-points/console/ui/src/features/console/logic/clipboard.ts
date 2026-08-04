const CLIPBOARD_UNAVAILABLE_MESSAGE =
  'Copying to the clipboard is not available in this browser context.';

const copyThroughDocumentSelection = (value: string): boolean => {
  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  textArea.setSelectionRange(0, value.length);
  const copied = document.execCommand('copy');
  textArea.remove();
  return copied;
};

export const copyTextToClipboard = async (value: string): Promise<void> => {
  const clipboard = navigator.clipboard;
  if (clipboard !== undefined && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(value);
      return;
    } catch {
      if (copyThroughDocumentSelection(value)) {
        return;
      }
      throw new Error(CLIPBOARD_UNAVAILABLE_MESSAGE);
    }
  }
  if (copyThroughDocumentSelection(value)) {
    return;
  }
  throw new Error(CLIPBOARD_UNAVAILABLE_MESSAGE);
};
