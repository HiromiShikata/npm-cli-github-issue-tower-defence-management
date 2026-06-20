import { render } from '@testing-library/react';
import { CONSOLE_ITEM_ICONS } from '../../logic/itemIcons';
import { ConsoleItemIcon } from './ConsoleItemIcon';

describe('ConsoleItemIcon', () => {
  it('renders the green open pull-request icon for an open PR', () => {
    const { getByRole } = render(
      <ConsoleItemIcon
        isPr
        state="open"
        merged={false}
        isDraft={false}
        stateReason=""
      />,
    );
    const svg = getByRole('img');
    expect(svg).toHaveAttribute('fill', CONSOLE_ITEM_ICONS.prOpen.color);
    expect(svg).toHaveAttribute('aria-label', 'prOpen');
  });

  it('renders the red closed pull-request icon for a closed PR', () => {
    const { getByRole } = render(
      <ConsoleItemIcon
        isPr
        state="closed"
        merged={false}
        isDraft={false}
        stateReason=""
      />,
    );
    expect(getByRole('img')).toHaveAttribute(
      'fill',
      CONSOLE_ITEM_ICONS.prClosed.color,
    );
  });

  it('renders the gray not-planned icon for a closed unplanned issue', () => {
    const { getByRole } = render(
      <ConsoleItemIcon
        isPr={false}
        state="closed"
        merged={false}
        isDraft={false}
        stateReason="not_planned"
      />,
    );
    expect(getByRole('img')).toHaveAttribute(
      'fill',
      CONSOLE_ITEM_ICONS.issueClosedNotPlanned.color,
    );
  });
});
