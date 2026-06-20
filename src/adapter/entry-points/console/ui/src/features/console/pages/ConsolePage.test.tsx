import { act, fireEvent, render, waitFor } from '@testing-library/react';
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
    expect(await findByText('Approve')).toBeInTheDocument();
    expect(window.location.hash).toBe('#item/PVTI_1');
  });

  it('renders the per-tab count sub-heading and snapshot time', async () => {
    const { getByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    expect(getByText('1 items awaiting quality check')).toBeInTheDocument();
    expect(getByText('snapshot: 2026-06-19T00:00:00.000Z')).toBeInTheDocument();
  });

  it('shows a cancellable toast and only drives the tab to zero after the five second window', async () => {
    jest.useFakeTimers();
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      expect(
        getByText('Awaiting Quality Check')
          .closest('a')
          ?.querySelector('.console-tab-badge')?.textContent,
      ).toBe('1');

      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve')).toBeInTheDocument();
      fireEvent.click(getByText('Approve'));

      expect(getByText('Approved — PR #851')).toBeInTheDocument();
      expect(getByText('Undo')).toBeInTheDocument();
      expect(
        getByText('Awaiting Quality Check')
          .closest('a')
          ?.querySelector('.console-tab-badge')?.textContent,
      ).toBe('1');

      act(() => {
        jest.advanceTimersByTime(5100);
      });

      await waitFor(() => {
        expect(
          getByText('Awaiting Quality Check')
            .closest('a')
            ?.querySelector('.console-tab-badge')?.textContent,
        ).toBe('0');
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancels the command and keeps the item pending when Undo is clicked', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = jest.fn(
        async (_url: string, init?: { method?: string }) => {
          const listMatch = _url.match(
            /\/projects\/[^/]+\/([^/]+)\/list\.json/,
          );
          if (listMatch !== null) {
            return {
              ok: true,
              status: 200,
              json: async () => listPayload(listMatch[1]),
            };
          }
          void init;
          return {
            ok: true,
            status: 200,
            json: async () => ({ body: '# body' }),
          };
        },
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve')).toBeInTheDocument();
      fireEvent.click(getByText('Approve'));

      fireEvent.click(getByText('Undo'));
      act(() => {
        jest.advanceTimersByTime(6000);
      });

      const postCalls = fetchMock.mock.calls.filter(
        (call) => call[1]?.method === 'POST',
      );
      expect(postCalls.length).toBe(0);
      expect(
        getByText('Awaiting Quality Check')
          .closest('a')
          ?.querySelector('.console-tab-badge')?.textContent,
      ).toBe('1');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not revive a zeroed tab badge after switching tabs', async () => {
    const { getByText, queryByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Unread'));
    await waitFor(() => {
      expect(
        getByText('Notify finished issue preparation'),
      ).toBeInTheDocument();
    });

    expect(queryByText('Triage')).toBeNull();
  });

  it('hides zero-count tabs but keeps non-zero tabs', async () => {
    const { getByText, queryByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    expect(queryByText('Awaiting Quality Check')).not.toBeNull();
    expect(queryByText('Unread')).not.toBeNull();
    expect(queryByText('Triage')).toBeNull();
    expect(queryByText('Failed Preparation')).toBeNull();
    expect(queryByText('Todo by human')).toBeNull();
  });

  it('does not render the project header bar above the tab bar', async () => {
    const { getByText, queryByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    expect(queryByText('TDPM Console')).toBeNull();
    expect(queryByText('project: umino')).toBeNull();
  });
});

const twoItemPrPayload = () => ({
  pjcode: 'umino',
  generatedAt: '2026-06-19T00:00:00.000Z',
  statusOptions: [{ id: 's1', name: 'Awaiting Workspace', color: 'BLUE' }],
  storyOptions: [{ id: 'st1', name: 'TDPM Console port', color: 'BLUE' }],
  storyColors: { 'TDPM Console port': { color: 'BLUE' } },
  items: [
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
    {
      number: 852,
      title: 'Add server-side console API handlers',
      url: 'https://github.com/o/r/pull/852',
      repo: 'o/r',
      nameWithOwner: 'o/r',
      projectItemId: 'PVTI_2',
      itemId: 'PVTI_2',
      isPr: true,
      story: 'TDPM Console port',
      labels: [],
      createdAt: '2026-06-17T01:00:00.000Z',
    },
  ],
});

const touchEvent = (
  type: string,
  point: { clientX: number; clientY: number },
  property: 'touches' | 'changedTouches',
): TouchEvent => {
  const event = new Event(type, { bubbles: true }) as TouchEvent;
  Object.defineProperty(event, property, {
    value: [point],
    configurable: true,
  });
  return event;
};

const swipeDetailScreen = (
  element: HTMLElement,
  from: { clientX: number; clientY: number },
  to: { clientX: number; clientY: number },
): void => {
  element.dispatchEvent(touchEvent('touchstart', from, 'touches'));
  element.dispatchEvent(touchEvent('touchmove', to, 'touches'));
  element.dispatchEvent(touchEvent('touchend', to, 'changedTouches'));
};

describe('ConsolePage swipe navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/umino/prs?k=token');
    const fetchMock = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        return {
          ok: true,
          status: 200,
          json: async () =>
            listMatch[1] === 'prs'
              ? twoItemPrPayload()
              : { ...twoItemPrPayload(), items: [] },
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('navigates to the next item on a left swipe of the opened detail screen', async () => {
    const { container, getByText, findByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('Approve')).toBeInTheDocument();
    expect(window.location.hash).toBe('#item/PVTI_1');

    const detailScreen = container.querySelector('.console-detail-screen');
    expect(detailScreen).not.toBeNull();
    swipeDetailScreen(
      detailScreen as HTMLElement,
      { clientX: 240, clientY: 100 },
      { clientX: 40, clientY: 110 },
    );

    await waitFor(() => {
      expect(window.location.hash).toBe('#item/PVTI_2');
    });
  });

  it('navigates to the previous item on a right swipe of the opened detail screen', async () => {
    const { container, getByText, findByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getByText('Add server-side console API handlers'),
      ).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add server-side console API handlers'));
    expect(await findByText('Approve')).toBeInTheDocument();
    expect(window.location.hash).toBe('#item/PVTI_2');

    const detailScreen = container.querySelector('.console-detail-screen');
    expect(detailScreen).not.toBeNull();
    swipeDetailScreen(
      detailScreen as HTMLElement,
      { clientX: 40, clientY: 100 },
      { clientX: 240, clientY: 110 },
    );

    await waitFor(() => {
      expect(window.location.hash).toBe('#item/PVTI_1');
    });
  });
});

describe('ConsolePage auto-advance', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/umino/prs?k=token');
    const fetchMock = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        return {
          ok: true,
          status: 200,
          json: async () =>
            listMatch[1] === 'prs'
              ? twoItemPrPayload()
              : { ...twoItemPrPayload(), items: [] },
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('advances the detail view to the next pending item after an action', async () => {
    jest.useFakeTimers();
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve')).toBeInTheDocument();
      expect(window.location.hash).toBe('#item/PVTI_1');

      fireEvent.click(getByText('Approve'));

      await waitFor(() => {
        expect(window.location.hash).toBe('#item/PVTI_2');
      });
    } finally {
      jest.useRealTimers();
    }
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
