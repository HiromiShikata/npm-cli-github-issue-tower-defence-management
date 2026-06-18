import { render, screen } from '@testing-library/react';
import { MarkdownView } from './MarkdownView';

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn(async () => ({ svg: '<svg><rect/></svg>' })),
  },
}));

describe('MarkdownView', () => {
  it('renders sanitized markdown content', () => {
    render(<MarkdownView source={'## Heading\n\nbody text'} />);
    expect(screen.getByText('Heading')).toBeInTheDocument();
    expect(screen.getByText('body text')).toBeInTheDocument();
  });

  it('renders the empty placeholder when the source is blank', () => {
    render(<MarkdownView source="   " emptyText="(nothing)" />);
    expect(screen.getByText('(nothing)')).toBeInTheDocument();
  });

  it('does not inject script content from untrusted markdown', () => {
    const { container } = render(
      <MarkdownView source={'text <script>window.x = 1;</script>'} />,
    );
    expect(container.querySelector('script')).toBeNull();
  });
});
