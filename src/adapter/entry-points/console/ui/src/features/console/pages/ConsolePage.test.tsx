import { fireEvent, render, waitFor } from '@testing-library/react';
import { ConsolePage } from './ConsolePage';

jest.mock('../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(async () => '<svg></svg>'),
}));

const listPayload = (tab: string) => ({
  pjcode: 'umino',
  generatedAt: '2026-06-19T00:00:00.000Z',
  statusOptions: [{ id: 's1', name: 'Awaiting Workspace', color: 'BLUE' }],
  storyOptions: [{ id: 'st1', name: 'TDPM Console port', color: 'BLUE' }],
  storyColors: { 'TDPM Console port': { color: 'BLUE' } },
  items:
    tab === 'prs'
      ? [
          {
            number: 851,
            title: 'Add serveConsole subcommand',
            url: 'https://github.com/o/r/pull/851',
            repo: 'o/r',
            nameWithOwner: 'o/r',
            projectItemId: 'PVTI_1',
            itemId: 'PVTI_1',
            isPr: true,
            story: 'TDPM Console port',
            labels: [],
            createdAt: '2026-06-17T00:00:00.000Z',
          },
        ]
      : tab === 'unread'
        ? [
            {
              number: 866,
              title: 'Notify finished issue preparation',
              url: 'https://github.com/o/r/issues/866',
              repo: 'o/r',
              nameWithOwner: 'o/r',
              projectItemId: 'PVTI_2',
              itemId: 'PVTI_2',
              isPr: false,
              story: 'TDPM Console port',
              labels: [],
              createdAt: '2026-06-18T00:00:00.000Z',
            },
          ]
        : [],
});

const installFetch = (): void => {
  const fetchMock = jest.fn(async (url: string) => {
    const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
    if (listMatch !== null) {
      return {
        ok: true,
        status: 200,
        json: async () => listPayload(listMatch[1]),
      };
    }
    return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
};

describe('ConsolePage', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/umino/prs?k=token');
    installFetch();
  });

  it('renders the tab bar with the active tab and the story-grouped list', async () => {
    const { getByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    expect(getByText('Awaiting Quality Check')).toBeInTheDocument();
    expect(getByText('TDPM Console port')).toBeInTheDocument();
  });

  it('opens the detail view when an item is selected', async () => {
    const { getByText, findByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('← Back to list')).toBeInTheDocument();
    expect(getByText('Approve')).toBeInTheDocument();
  });

  it('keeps a tab driven to zero at zero and does not revive its badge after switching tabs', async () => {
    const { getByText, queryByText, findByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    expect(
      getByText('Awaiting Quality Check')
        .closest('button')
        ?.querySelector('.console-tab-badge')?.textContent,
    ).toBe('1');

    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('← Back to list')).toBeInTheDocument();
    fireEvent.click(getByText('Approve'));

    await waitFor(() => {
      expect(
        getByText('Awaiting Quality Check')
          .closest('button')
          ?.querySelector('.console-tab-badge')?.textContent,
      ).toBe('0');
    });

    fireEvent.click(getByText('Unread'));
    await waitFor(() => {
      expect(
        getByText('Notify finished issue preparation'),
      ).toBeInTheDocument();
    });

    const prsTabButton = queryByText('Awaiting Quality Check')?.closest(
      'button',
    );
    const prsBadge =
      prsTabButton?.querySelector('.console-tab-badge')?.textContent ?? '0';
    expect(prsBadge).toBe('0');
  });

  it('auto-advances to the next non-empty tab on the right after the active tab is driven to zero', async () => {
    const { getByText, findByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('← Back to list')).toBeInTheDocument();
    fireEvent.click(getByText('Approve'));

    await waitFor(() => {
      expect(
        getByText('Notify finished issue preparation'),
      ).toBeInTheDocument();
    });
    expect(
      getByText('Unread').closest('button')?.getAttribute('aria-current'),
    ).toBe('page');
  });
});
