import { render } from '@testing-library/react';
import { CONSOLE_ITEM_ICONS } from '../../logic/itemIcons';
import { ConsoleReferenceLink } from './ConsoleReferenceLink';

describe('ConsoleReferenceLink', () => {
  const href = 'https://github.com/octo/repo/pull/7';

  it('renders the state icon, fetched title, and issue number when state is resolved', () => {
    const { container, getByText } = render(
      <ConsoleReferenceLink
        href={href}
        fallbackText={href}
        state={{
          state: 'open',
          merged: false,
          isPullRequest: true,
          title: 'Decorate PR links',
          stateReason: '',
        }}
      />,
    );
    expect(getByText('Decorate PR links')).toBeInTheDocument();
    expect(container.querySelector('.console-item-icon')).not.toBeNull();
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe(href);
    expect(
      container.querySelector('.console-markdown-reference-number'),
    ).not.toBeNull();
    expect(
      container.querySelector('.console-markdown-reference-number')
        ?.textContent,
    ).toBe('#7');
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
          stateReason: '',
        }}
      />,
    );
    expect(container.querySelector('.console-item-icon')).toBeNull();
    expect(
      container.querySelector('.console-markdown-reference-plain'),
    ).not.toBeNull();
  });

  it('renders the icon in the not-planned color for a resolved closed reference whose state carries a not_planned stateReason', () => {
    const { container } = render(
      <ConsoleReferenceLink
        href={href}
        fallbackText={href}
        state={{
          state: 'closed',
          merged: false,
          isPullRequest: false,
          title: 'Old task',
          stateReason: 'not_planned',
        }}
      />,
    );
    expect(container.querySelector('.console-item-icon')).toHaveAttribute(
      'fill',
      CONSOLE_ITEM_ICONS.issueClosedNotPlanned.color,
    );
  });

  it('renders the icon in the completed closed color for a resolved closed reference whose state carries a completed stateReason', () => {
    const { container } = render(
      <ConsoleReferenceLink
        href={href}
        fallbackText={href}
        state={{
          state: 'closed',
          merged: false,
          isPullRequest: false,
          title: 'Old task',
          stateReason: 'completed',
        }}
      />,
    );
    expect(container.querySelector('.console-item-icon')).toHaveAttribute(
      'fill',
      CONSOLE_ITEM_ICONS.issueClosed.color,
    );
  });

  it('renders the icon in the open color for a resolved open reference regardless of a stale stateReason', () => {
    const { container } = render(
      <ConsoleReferenceLink
        href={href}
        fallbackText={href}
        state={{
          state: 'open',
          merged: false,
          isPullRequest: false,
          title: 'Fix bug',
          stateReason: 'not_planned',
        }}
      />,
    );
    expect(container.querySelector('.console-item-icon')).toHaveAttribute(
      'fill',
      CONSOLE_ITEM_ICONS.issueOpen.color,
    );
  });
});
