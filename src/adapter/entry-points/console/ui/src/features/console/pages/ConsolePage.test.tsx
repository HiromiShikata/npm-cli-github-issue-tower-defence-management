import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react';
import { ConsolePage } from './ConsolePage';

const tabBar = (): HTMLElement => {
  const nav = document.querySelector('nav.console-tabbar');
  if (nav === null) {
    throw new Error('console tab bar not found');
  }
  return nav as HTMLElement;
};

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
            status: 'Awaiting Quality Check',
            nextActionDate: null,
            nextActionHour: null,
            dependedIssueUrls: [],
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
              status: 'Unread',
              nextActionDate: null,
              nextActionHour: null,
              dependedIssueUrls: [],
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
    expect(
      within(tabBar()).getByText('Awaiting Quality Check'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('.console-group-header')?.textContent,
    ).toContain('TDPM Console port');
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

  it('renders the snapshot time without an item-count sub-heading', async () => {
    const { getByText, container } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    expect(container.querySelector('.console-tab-count-heading')).toBeNull();
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
        within(tabBar())
          .getByText('Awaiting Quality Check')
          .closest('a')
          ?.querySelector('.console-tab-badge')?.textContent,
      ).toBe('1');

      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve')).toBeInTheDocument();
      fireEvent.click(getByText('Approve'));

      expect(getByText('Approved — PR #851')).toBeInTheDocument();
      expect(getByText('Undo')).toBeInTheDocument();
      expect(
        within(tabBar())
          .getByText('Awaiting Quality Check')
          .closest('a')
          ?.querySelector('.console-tab-badge')?.textContent,
      ).toBe('1');

      act(() => {
        jest.advanceTimersByTime(5100);
      });

      await waitFor(() => {
        expect(
          within(tabBar()).queryByText('Awaiting Quality Check'),
        ).toBeNull();
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
        within(tabBar())
          .getByText('Awaiting Quality Check')
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
    const { getByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    const tabs = within(tabBar());
    expect(tabs.queryByText('Awaiting Quality Check')).not.toBeNull();
    expect(tabs.queryByText('Unread')).not.toBeNull();
    expect(tabs.queryByText('Triage')).toBeNull();
    expect(tabs.queryByText('Failed Preparation')).toBeNull();
    expect(tabs.queryByText('Todo by human')).toBeNull();
  });

  it('does not render the project header bar above the tab bar', async () => {
    const { getByText, queryByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    expect(queryByText('TDPM Console')).toBeNull();
    expect(queryByText('project: umino')).toBeNull();
  });

  it('renders the failure toast in English without any Japanese characters', async () => {
    const fetchMock = jest.fn(
      async (url: string, init?: { method?: string }) => {
        const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
        if (listMatch !== null) {
          return {
            ok: true,
            status: 200,
            json: async () => listPayload(listMatch[1]),
          };
        }
        if (init?.method === 'POST') {
          return {
            ok: false,
            status: 422,
            text: async () =>
              JSON.stringify({ error: 'HTTP 422 Review cannot be requested' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ body: '# body' }),
        };
      },
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    jest.useFakeTimers();
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      fireEvent.click(getByText('Add serveConsole subcommand'));
      fireEvent.click(await findByText('Approve'));

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      const toast = getByText(/^Operation failed:/);
      expect(toast.textContent).toBe(
        'Operation failed: HTTP 422 Review cannot be requested',
      );
      expect(toast.textContent).not.toMatch(
        /[\u{3040}-\u{309F}\u{30A0}-\u{30FF}\u{4E00}-\u{9FFF}]/u,
      );
    } finally {
      jest.useRealTimers();
    }
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
      status: 'Awaiting Quality Check',
      nextActionDate: null,
      nextActionHour: null,
      dependedIssueUrls: [],
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
      status: 'Awaiting Quality Check',
      nextActionDate: null,
      nextActionHour: null,
      dependedIssueUrls: [],
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
});

describe('ConsolePage auto-advance tab', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/umino/prs?k=token');
    installFetch();
  });

  it('auto-advances to the next non-empty tab on the right after the active tab is driven to zero', async () => {
    jest.useFakeTimers();
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });

      fireEvent.click(getByText('Add serveConsole subcommand'));
      fireEvent.click(await findByText('Approve'));

      act(() => {
        jest.advanceTimersByTime(5100);
      });

      await waitFor(() => {
        expect(
          getByText('Notify finished issue preparation'),
        ).toBeInTheDocument();
      });
      expect(
        within(tabBar())
          .getByText('Unread')
          .closest('a')
          ?.getAttribute('aria-current'),
      ).toBe('page');
    } finally {
      jest.useRealTimers();
    }
  });
});
