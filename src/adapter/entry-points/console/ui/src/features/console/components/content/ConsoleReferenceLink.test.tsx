import { render } from '@testing-library/react';
import { ConsoleReferenceLink } from './ConsoleReferenceLink';

describe('ConsoleReferenceLink', () => {
  const href = 'https://github.com/octo/repo/pull/7';

  it('renders the state icon and fetched title when state is resolved', () => {
    const { container, getByText } = render(
      <ConsoleReferenceLink
        href={href}
        fallbackText={href}
        state={{
          state: 'open',
          merged: false,
          isPullRequest: true,
          title: 'Decorate PR links',
        }}
      />,
    );
    expect(getByText('Decorate PR links')).toBeInTheDocument();
    expect(container.querySelector('.console-item-icon')).not.toBeNull();
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe(href);
  });

  it('falls back to the plain link when state is null', () => {
    const { container, getByText } = render(
      <ConsoleReferenceLink
        href={href}
        fallbackText="plain text"
        state={null}
      />,
    );
    expect(getByText('plain text')).toBeInTheDocument();
    expect(container.querySelector('.console-item-icon')).toBeNull();
  });

  it('falls back to the plain link when the resolved title is empty', () => {
    const { container } = render(
      <ConsoleReferenceLink
        href={href}
        fallbackText="plain text"
        state={{
          state: 'open',
          merged: false,
          isPullRequest: true,
          title: '',
        }}
      />,
    );
    expect(container.querySelector('.console-item-icon')).toBeNull();
    expect(
      container.querySelector('.console-markdown-reference-plain'),
    ).not.toBeNull();
  });
});
