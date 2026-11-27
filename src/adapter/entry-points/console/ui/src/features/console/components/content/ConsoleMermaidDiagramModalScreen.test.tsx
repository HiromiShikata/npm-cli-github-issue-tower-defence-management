import { fireEvent, render, screen } from '@testing-library/react';
import { MERMAID_ZOOM_MAX_SCALE } from '../../lib/mermaidZoom';
import { ConsoleMermaidDiagramModalScreen } from './ConsoleMermaidDiagramModalScreen';

const codeFixture = 'graph TD; A-->B;';

describe('ConsoleMermaidDiagramModalScreen', () => {
  it('shows the diagram at the minimum scale first', () => {
    const { container } = render(
      <ConsoleMermaidDiagramModalScreen code={codeFixture} onClose={() => {}} />,
    );
    expect(
      container.querySelector('.console-mermaid-modal-canvas iframe[title="Mermaid diagram"]'),
    ).not.toBeNull();
    expect(screen.getByText('100%')).toBeInTheDocument();
    const canvas = container.querySelector<HTMLElement>(
      '.console-mermaid-modal-canvas',
    );
    expect(canvas?.style.width).toBe('100%');
  });

  it('widens the canvas when zooming in', () => {
    const { container } = render(
      <ConsoleMermaidDiagramModalScreen code={codeFixture} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(screen.getByText('150%')).toBeInTheDocument();
    const canvas = container.querySelector<HTMLElement>(
      '.console-mermaid-modal-canvas',
    );
    expect(canvas?.style.width).toBe('150%');
  });

  it('asks the frame to fill the canvas width', () => {
    render(
      <ConsoleMermaidDiagramModalScreen code={codeFixture} onClose={() => {}} />,
    );
    const frame = screen.getByTitle('Mermaid diagram') as HTMLIFrameElement;
    const frameWindow = frame.contentWindow as Window;
    const postMessage = jest
      .spyOn(frameWindow, 'postMessage')
      .mockImplementation(() => undefined);
    fireEvent.load(frame);
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'render', requestId: 1, code: codeFixture, fillWidth: true },
      '*',
    );
  });

  it('cannot zoom out below the minimum', () => {
    render(
      <ConsoleMermaidDiagramModalScreen code={codeFixture} onClose={() => {}} />,
    );
    expect(screen.getByLabelText('Zoom out')).toBeDisabled();
  });

  it('stops zooming in at the maximum', () => {
    render(
      <ConsoleMermaidDiagramModalScreen code={codeFixture} onClose={() => {}} />,
    );
    const zoomIn = screen.getByLabelText('Zoom in');
    for (let step = 0; step < 20; step += 1) {
      if (!(zoomIn as HTMLButtonElement).disabled) {
        fireEvent.click(zoomIn);
      }
    }
    expect(
      screen.getByText(`${MERMAID_ZOOM_MAX_SCALE * 100}%`),
    ).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
  });

  it('closes on the close control', () => {
    const onClose = jest.fn();
    render(
      <ConsoleMermaidDiagramModalScreen code={codeFixture} onClose={onClose} />,
    );
    fireEvent.click(screen.getByLabelText('Close enlarged diagram'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on the escape key', () => {
    const onClose = jest.fn();
    render(
      <ConsoleMermaidDiagramModalScreen code={codeFixture} onClose={onClose} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
