import { fireEvent, render, screen } from '@testing-library/react';
import { MERMAID_ZOOM_MAX_SCALE } from '../../lib/mermaidZoom';
import { ConsoleMermaidDiagramModalScreen } from './ConsoleMermaidDiagramModalScreen';

const svgFixture = '<svg id="enlarged"></svg>';

describe('ConsoleMermaidDiagramModalScreen', () => {
  it('shows the diagram at the minimum scale first', () => {
    const { container } = render(
      <ConsoleMermaidDiagramModalScreen svg={svgFixture} onClose={() => {}} />,
    );
    expect(container.querySelector('svg#enlarged')).not.toBeNull();
    expect(screen.getByText('100%')).toBeInTheDocument();
    const canvas = container.querySelector<HTMLElement>(
      '.console-mermaid-modal-canvas',
    );
    expect(canvas?.style.width).toBe('100%');
  });

  it('widens the canvas when zooming in', () => {
    const { container } = render(
      <ConsoleMermaidDiagramModalScreen svg={svgFixture} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(screen.getByText('150%')).toBeInTheDocument();
    const canvas = container.querySelector<HTMLElement>(
      '.console-mermaid-modal-canvas',
    );
    expect(canvas?.style.width).toBe('150%');
  });

  it('lets the diagram outgrow the width mermaid fixed on it', () => {
    const { container } = render(
      <ConsoleMermaidDiagramModalScreen
        svg='<svg id="enlarged" style="max-width: 320px;"></svg>'
        onClose={() => {}}
      />,
    );
    const diagram = container.querySelector<SVGSVGElement>('svg#enlarged');
    expect(diagram?.style.maxWidth).toBe('');
    expect(diagram?.style.width).toBe('100%');
    expect(diagram?.style.height).toBe('auto');
  });

  it('cannot zoom out below the minimum', () => {
    render(
      <ConsoleMermaidDiagramModalScreen svg={svgFixture} onClose={() => {}} />,
    );
    expect(screen.getByLabelText('Zoom out')).toBeDisabled();
  });

  it('stops zooming in at the maximum', () => {
    render(
      <ConsoleMermaidDiagramModalScreen svg={svgFixture} onClose={() => {}} />,
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
      <ConsoleMermaidDiagramModalScreen svg={svgFixture} onClose={onClose} />,
    );
    fireEvent.click(screen.getByLabelText('Close enlarged diagram'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on the escape key', () => {
    const onClose = jest.fn();
    render(
      <ConsoleMermaidDiagramModalScreen svg={svgFixture} onClose={onClose} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
