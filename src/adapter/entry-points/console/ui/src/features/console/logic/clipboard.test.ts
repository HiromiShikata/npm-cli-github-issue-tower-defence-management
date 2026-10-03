import { copyTextToClipboard } from './clipboard';

describe('copyTextToClipboard', () => {
  const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
    window.navigator,
    'clipboard',
  );

  const setClipboard = (clipboard: unknown): void => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: clipboard,
      configurable: true,
    });
  };

  afterEach(() => {
    if (originalClipboardDescriptor === undefined) {
      Reflect.deleteProperty(window.navigator, 'clipboard');
    } else {
      Object.defineProperty(
        window.navigator,
        'clipboard',
        originalClipboardDescriptor,
      );
    }
    jest.restoreAllMocks();
  });

  it('writes through the clipboard api when it is available', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await copyTextToClipboard('copied value');

    expect(writeText).toHaveBeenCalledWith('copied value');
  });

  it('copies through the document selection command when the clipboard api is absent', async () => {
    setClipboard(undefined);
    const execCommand = jest.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });

    await copyTextToClipboard('value on a plain http origin');

    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('leaves no element behind after the document selection command', async () => {
    setClipboard(undefined);
    Object.defineProperty(document, 'execCommand', {
      value: jest.fn().mockReturnValue(true),
      configurable: true,
    });
    const childCountBefore = document.body.childElementCount;

    await copyTextToClipboard('value on a plain http origin');

    expect(document.body.childElementCount).toBe(childCountBefore);
  });

  it('rejects when the clipboard api rejects, even though the document selection command would succeed', async () => {
    setClipboard({
      writeText: jest.fn().mockRejectedValue(new Error('denied')),
    });
    const execCommand = jest.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });

    await expect(copyTextToClipboard('value')).rejects.toThrow('denied');

    expect(execCommand).not.toHaveBeenCalled();
  });

  it('rejects when neither the clipboard api nor the document selection command copies', async () => {
    setClipboard(undefined);
    Object.defineProperty(document, 'execCommand', {
      value: jest.fn().mockReturnValue(false),
      configurable: true,
    });

    await expect(copyTextToClipboard('value')).rejects.toThrow(
      'Copying to the clipboard is not available in this browser context.',
    );
  });
});
