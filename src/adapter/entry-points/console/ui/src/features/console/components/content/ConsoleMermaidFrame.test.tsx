import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  ConsoleMermaidFrame,
  MERMAID_FRAME_RESPONSE_TIMEOUT_MS,
} from './ConsoleMermaidFrame';

const getFrame = (): HTMLIFrameElement =>
  screen.getByTitle('Mermaid diagram') as HTMLIFrameElement;

const loadFrame = (): Window => {
  const frame = getFrame();
  fireEvent.load(frame);
  const frameWindow = frame.contentWindow;
  if (frameWindow === null) {
    throw new Error('frame has no window');
  }
  return frameWindow;
};

const respondFromFrame = (frameWindow: Window, data: unknown): void => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', { data, source: frameWindow }),
    );
  });
};

describe('ConsoleMermaidFrame', () => {
  it('loads the Mermaid frame in a scripts-only sandbox', () => {
    render(<ConsoleMermaidFrame code="graph TD; A-->B;" fillWidth={false} />);
    const frame = getFrame();
    expect(frame.getAttribute('src')).toBe('/mermaid-frame.html');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
  });

  it('sends the diagram to the frame only after the frame has loaded', () => {
    render(<ConsoleMermaidFrame code="graph TD; A-->B;" fillWidth={false} />);
    const frame = getFrame();
    const frameWindow = frame.contentWindow as Window;
    const postMessage = jest
      .spyOn(frameWindow, 'postMessage')
      .mockImplementation(() => undefined);
    expect(postMessage).not.toHaveBeenCalled();
    loadFrame();
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'render',
        requestId: 1,
        code: 'graph TD; A-->B;',
        fillWidth: false,
      },
      '*',
    );
  });

  it('sizes the frame to the height the frame reports and hides the loading note', () => {
    render(<ConsoleMermaidFrame code="graph TD; A-->B;" fillWidth={false} />);
    const frameWindow = loadFrame();
    expect(screen.getByText('Rendering diagram...')).toBeInTheDocument();
    respondFromFrame(frameWindow, {
      type: 'size',
      requestId: 1,
      height: 260,
    });
    expect(getFrame().style.height).toBe('260px');
    expect(screen.queryByText('Rendering diagram...')).toBeNull();
  });

  it('shows the error message and the source when the frame reports a failure', () => {
    render(<ConsoleMermaidFrame code="bad diagram" fillWidth={false} />);
    const frameWindow = loadFrame();
    respondFromFrame(frameWindow, {
      type: 'failed',
      requestId: 1,
      message: 'parse error',
    });
    expect(
      screen.getByText(/Mermaid render error: parse error/),
    ).toBeInTheDocument();
    expect(screen.getByText('bad diagram')).toBeInTheDocument();
  });

  it('ignores a report that does not come from its own frame', () => {
    render(<ConsoleMermaidFrame code="graph TD; A-->B;" fillWidth={false} />);
    loadFrame();
    respondFromFrame(window, { type: 'size', requestId: 1, height: 300 });
    expect(screen.getByText('Rendering diagram...')).toBeInTheDocument();
    expect(getFrame().style.height).toBe('0px');
  });

  it('ignores a stale report for a diagram that has since changed', () => {
    const { rerender } = render(
      <ConsoleMermaidFrame code="graph TD; A-->B;" fillWidth={false} />,
    );
    const frameWindow = loadFrame();
    rerender(<ConsoleMermaidFrame code="graph TD; C-->D;" fillWidth={false} />);
    respondFromFrame(frameWindow, { type: 'size', requestId: 1, height: 300 });
    expect(screen.getByText('Rendering diagram...')).toBeInTheDocument();
    respondFromFrame(frameWindow, { type: 'size', requestId: 2, height: 310 });
    expect(getFrame().style.height).toBe('310px');
  });

  it('asks the frame to render again when the code changes after loading', () => {
    const { rerender } = render(
      <ConsoleMermaidFrame code="graph TD; A-->B;" fillWidth={false} />,
    );
    const frameWindow = loadFrame();
    const postMessage = jest
      .spyOn(frameWindow, 'postMessage')
      .mockImplementation(() => undefined);
    rerender(<ConsoleMermaidFrame code="graph TD; C-->D;" fillWidth />);
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'render',
        requestId: 2,
        code: 'graph TD; C-->D;',
        fillWidth: true,
      },
      '*',
    );
  });

  it('shows the source with an error when the frame does not answer in time', () => {
    jest.useFakeTimers();
    try {
      render(<ConsoleMermaidFrame code="graph TD; A-->B;" fillWidth={false} />);
      loadFrame();
      expect(screen.getByText('Rendering diagram...')).toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(MERMAID_FRAME_RESPONSE_TIMEOUT_MS);
      });
      expect(
        screen.getByText(/Mermaid render error: Mermaid frame did not respond/),
      ).toBeInTheDocument();
      expect(screen.getByText('graph TD; A-->B;')).toBeInTheDocument();
      expect(screen.queryByText('Rendering diagram...')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps a diagram that answered in time and does not fail it later', () => {
    jest.useFakeTimers();
    try {
      render(<ConsoleMermaidFrame code="graph TD; A-->B;" fillWidth={false} />);
      const frameWindow = loadFrame();
      respondFromFrame(frameWindow, {
        type: 'size',
        requestId: 1,
        height: 200,
      });
      act(() => {
        jest.advanceTimersByTime(MERMAID_FRAME_RESPONSE_TIMEOUT_MS * 2);
      });
      expect(getFrame().style.height).toBe('200px');
      expect(screen.queryByText(/did not respond/)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('loads the frame from the source it is given', () => {
    render(
      <ConsoleMermaidFrame
        code="graph TD; A-->B;"
        fillWidth={false}
        frameSource="data:text/html,mock"
      />,
    );
    expect(getFrame().getAttribute('src')).toBe('data:text/html,mock');
  });
});
