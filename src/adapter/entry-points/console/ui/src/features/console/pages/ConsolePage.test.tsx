import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react';
import { CONSOLE_TAB_REFRESH_INTERVAL_MS } from '../hooks/useConsoleTabData';
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

jest.mock('../lib/navigation', () => ({
  navigateReplace: jest.fn(),
  navigateAssign: jest.fn(),
}));

const listPayload = (tab: string) => ({
  pjcode: 'acme',
  generatedAt: '2026-06-19T00:00:00.000Z',
  statusOptions: [{ id: 's1', name: 'Awaiting Workspace', color: 'BLUE' }],
  agentOptions:
    tab === 'prs'
      ? [
          { id: 'ag1', name: 'developer', color: 'GRAY' },
          { id: 'ag2', name: 'pr-reviewer', color: 'GRAY' },
        ]
      : [],
  storyOptions: [{ id: 'st1', name: 'TDPM Console port', color: 'BLUE' }],
  storyColors: { 'TDPM Console port': { color: 'BLUE' } },
  stories: [
    {
      storyName: 'TDPM Console port',
      storyOptionId: 'st1',
      color: 'BLUE',
      openItemCount: 1,
      storyViewUrl: null,
    },
  ],
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
            relatedOpenPullRequestUrls: [],
            story: 'TDPM Console port',
            status: 'Awaiting Quality Check',
            agent: 'developer',
            nextActionDate: null,
            nextActionHour: null,
            dependedIssueUrls: [],
            labels: [],
            createdAt: '2026-06-17T00:00:00.000Z',
          },
        ]
      : tab === 'todo-by-human'
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
              relatedOpenPullRequestUrls: [],
              story: 'TDPM Console port',
              status: 'Todo by human',
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
    if (url === '/api/projects') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ pjcodes: ['acme'] }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
};

describe('ConsolePage', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
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

  it('shows the agent filter select on the prs tab when agentOptions are present', async () => {
    const { getByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getByRole('combobox', { name: 'Filter by agent' }),
      ).toBeInTheDocument();
    });
  });

  it('hides agents with zero tasks from the selector and shows the count for agents with tasks', async () => {
    const { getByRole, getAllByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getByRole('combobox', { name: 'Filter by agent' }),
      ).toBeInTheDocument();
    });
    const options = getAllByRole('option');
    const nonAllOptions = options.filter((o) => o.getAttribute('value') !== '');
    expect(nonAllOptions.length).toBe(1);
    expect(nonAllOptions[0]).toHaveValue('developer');
    expect(nonAllOptions[0]).toHaveTextContent('developer (1)');
    const prReviewerOption = options.find(
      (o) => o.getAttribute('value') === 'pr-reviewer',
    );
    expect(prReviewerOption).toBeUndefined();
  });

  describe('prs agent filter', () => {
    const installFetchWithTwoPrsItems = (): void => {
      const fetchMock = jest.fn(async (url: string) => {
        const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
        if (listMatch !== null) {
          const tab = listMatch[1];
          const payload =
            tab === 'prs'
              ? {
                  ...listPayload('prs'),
                  items: [
                    ...listPayload('prs').items,
                    {
                      number: 852,
                      title: 'Review PR for agent filter feature',
                      url: 'https://github.com/o/r/pull/852',
                      repo: 'o/r',
                      nameWithOwner: 'o/r',
                      projectItemId: 'PVTI_3',
                      itemId: 'PVTI_3',
                      isPr: true,
                      relatedOpenPullRequestUrls: [],
                      story: 'TDPM Console port',
                      status: 'Awaiting Quality Check',
                      agent: 'pr-reviewer',
                      nextActionDate: null,
                      nextActionHour: null,
                      dependedIssueUrls: [],
                      labels: [],
                      createdAt: '2026-06-18T00:00:00.000Z',
                    },
                  ],
                }
              : listPayload(tab);
          return { ok: true, status: 200, json: async () => payload };
        }
        if (url === '/api/projects') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ pjcodes: ['acme'] }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ body: '# body' }),
        };
      });
      global.fetch = fetchMock as unknown as typeof fetch;
    };

    beforeEach(() => {
      installFetchWithTwoPrsItems();
    });

    it('filters prs items to the selected agent when an agent is chosen', async () => {
      const { getByRole, getByText, queryByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getByText('Review PR for agent filter feature'),
        ).toBeInTheDocument();
      });
      fireEvent.change(getByRole('combobox', { name: 'Filter by agent' }), {
        target: { value: 'developer' },
      });
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      expect(queryByText('Review PR for agent filter feature')).toBeNull();
    });

    it('shows all prs items again when the agent filter is cleared', async () => {
      const { getByRole, getByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getByText('Review PR for agent filter feature'),
        ).toBeInTheDocument();
      });
      fireEvent.change(getByRole('combobox', { name: 'Filter by agent' }), {
        target: { value: 'developer' },
      });
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      fireEvent.change(getByRole('combobox', { name: 'Filter by agent' }), {
        target: { value: '' },
      });
      expect(
        getByText('Review PR for agent filter feature'),
      ).toBeInTheDocument();
    });

    it('shows task counts next to each agent name in the selector options', async () => {
      const { getByRole, getAllByRole } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getByRole('combobox', { name: 'Filter by agent' }),
        ).toBeInTheDocument();
      });
      const options = getAllByRole('option');
      const developerOption = options.find(
        (o) => o.getAttribute('value') === 'developer',
      );
      expect(developerOption).toHaveTextContent('developer (1)');
      const prReviewerOption = options.find(
        (o) => o.getAttribute('value') === 'pr-reviewer',
      );
      expect(prReviewerOption).toHaveTextContent('pr-reviewer (1)');
    });

    it('resets prs agent filter when the selected agent no longer has tasks after a data refresh', async () => {
      jest.useFakeTimers();
      try {
        let includeDeveloper = true;
        const fetchMock = jest.fn(async (url: string) => {
          const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
          if (listMatch !== null) {
            const tab = listMatch[1];
            if (tab === 'prs') {
              const prsItems = [
                ...(includeDeveloper
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
                        relatedOpenPullRequestUrls: [],
                        story: 'TDPM Console port',
                        status: 'Awaiting Quality Check',
                        agent: 'developer',
                        nextActionDate: null,
                        nextActionHour: null,
                        dependedIssueUrls: [],
                        labels: [],
                        createdAt: '2026-06-17T00:00:00.000Z',
                      },
                    ]
                  : []),
                {
                  number: 852,
                  title: 'Review PR for agent filter feature',
                  url: 'https://github.com/o/r/pull/852',
                  repo: 'o/r',
                  nameWithOwner: 'o/r',
                  projectItemId: 'PVTI_3',
                  itemId: 'PVTI_3',
                  isPr: true,
                  relatedOpenPullRequestUrls: [],
                  story: 'TDPM Console port',
                  status: 'Awaiting Quality Check',
                  agent: 'pr-reviewer',
                  nextActionDate: null,
                  nextActionHour: null,
                  dependedIssueUrls: [],
                  labels: [],
                  createdAt: '2026-06-18T00:00:00.000Z',
                },
              ];
              return {
                ok: true,
                status: 200,
                json: async () => ({ ...listPayload('prs'), items: prsItems }),
              };
            }
            return {
              ok: true,
              status: 200,
              json: async () => listPayload(tab),
            };
          }
          if (url === '/api/projects') {
            return {
              ok: true,
              status: 200,
              json: async () => ({ pjcodes: ['acme'] }),
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ body: '# body' }),
          };
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        const { getByRole, queryByText } = render(<ConsolePage />);
        await waitFor(() => {
          expect(
            queryByText('Review PR for agent filter feature'),
          ).toBeInTheDocument();
        });

        fireEvent.change(getByRole('combobox', { name: 'Filter by agent' }), {
          target: { value: 'developer' },
        });
        expect(queryByText('Add serveConsole subcommand')).toBeInTheDocument();
        expect(queryByText('Review PR for agent filter feature')).toBeNull();

        includeDeveloper = false;
        await act(async () => {
          jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
        });

        await waitFor(() => {
          expect(
            queryByText('Review PR for agent filter feature'),
          ).toBeInTheDocument();
        });
      } finally {
        jest.useRealTimers();
      }
    });
  });

  it('keeps a stale overlay status out of the detail header and shows the snapshot status instead', async () => {
    localStorage.setItem(
      'pv_overlay_acme',
      JSON.stringify({
        PVTI_1: {
          status: { name: 'In Tmux by human', color: 'RED' },
          ts: Date.parse('2026-06-18T00:00:00.000Z'),
          mode: 'prs',
        },
      }),
    );
    const { getByText, findByText, queryByText, container } = render(
      <ConsolePage />,
    );
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('Approve & Merge')).toBeInTheDocument();
    expect(queryByText('In Tmux by human')).toBeNull();
    const chip = container.querySelector('.console-detail-status-chip');
    expect(chip?.textContent).toBe('Awaiting Quality Check');
  });

  it('shows a status the owner set after the snapshot was generated in the detail header', async () => {
    localStorage.setItem(
      'pv_overlay_acme',
      JSON.stringify({
        PVTI_1: {
          status: { name: 'In Tmux by human', color: 'RED' },
          ts: Date.parse('2026-06-19T00:10:00.000Z'),
          mode: 'prs',
        },
      }),
    );
    const { getByText, findByText, container } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('Approve & Merge')).toBeInTheDocument();
    expect(
      container.querySelector('.console-detail-status-chip')?.textContent,
    ).toBe('In Tmux by human');
  });

  it('opens the detail view when an item is selected', async () => {
    const { getByText, findByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('Approve & Merge')).toBeInTheDocument();
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
      expect(await findByText('Approve & Merge')).toBeInTheDocument();
      fireEvent.click(getByText('Approve & Merge'));

      expect(getByText('Approved & Merged — PR #851')).toBeInTheDocument();
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
      expect(await findByText('Approve & Merge')).toBeInTheDocument();
      fireEvent.click(getByText('Approve & Merge'));

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

    fireEvent.click(getByText('Todo by human'));
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
    expect(tabs.queryByText('Todo by human')).not.toBeNull();
    expect(tabs.queryByText('Triage')).toBeNull();
    expect(tabs.queryByText('Failed Preparation')).toBeNull();
  });

  it('does not render the project header bar above the tab bar', async () => {
    const { getByText, queryByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    expect(queryByText('TDPM Console')).toBeNull();
    expect(queryByText('project: acme')).toBeNull();
  });

  it('removes a processed workflow-blocker item from the list and decrements its tab badge, like every other tab', async () => {
    const blockerItems = [
      {
        number: 701,
        title: 'Blocked deployment task',
        url: 'https://github.com/o/r/issues/701',
        repo: 'o/r',
        nameWithOwner: 'o/r',
        projectItemId: 'PVTI_B1',
        itemId: 'PVTI_B1',
        isPr: false,
        relatedOpenPullRequestUrls: [],
        story: 'TDPM Console port',
        status: 'In Progress',
        nextActionDate: null,
        nextActionHour: null,
        dependedIssueUrls: [],
        labels: [],
        createdAt: '2026-06-17T00:00:00.000Z',
      },
      {
        number: 702,
        title: 'Blocked rollout task',
        url: 'https://github.com/o/r/issues/702',
        repo: 'o/r',
        nameWithOwner: 'o/r',
        projectItemId: 'PVTI_B2',
        itemId: 'PVTI_B2',
        isPr: false,
        relatedOpenPullRequestUrls: [],
        story: 'TDPM Console port',
        status: 'In Progress',
        nextActionDate: null,
        nextActionHour: null,
        dependedIssueUrls: [],
        labels: [],
        createdAt: '2026-06-17T01:00:00.000Z',
      },
    ];
    const fetchMock = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        return {
          ok: true,
          status: 200,
          json: async () =>
            listMatch[1] === 'workflow-blocker'
              ? { ...listPayload('workflow-blocker'), items: blockerItems }
              : listPayload(listMatch[1]),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    localStorage.setItem(
      'pv_overlay_acme',
      JSON.stringify({
        PVTI_B1: {
          ts: Date.parse('2026-06-19T00:05:00.000Z'),
          mode: 'workflow-blocker',
          done: true,
        },
      }),
    );
    window.history.replaceState(
      {},
      '',
      '/projects/acme/workflow-blocker?k=token',
    );

    const { getByText, queryByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Blocked rollout task')).toBeInTheDocument();
    });
    expect(queryByText('Blocked deployment task')).toBeNull();
    const blockerTab = within(tabBar())
      .getByText('Workflow Blocker')
      .closest('a');
    expect(blockerTab).not.toBeNull();
    expect(blockerTab?.querySelector('.console-tab-badge')?.textContent).toBe(
      '1',
    );
  });

  it('lists an item again when the overlay marked it done before the served snapshot was generated', async () => {
    const blockerItems = [
      {
        number: 701,
        title: 'Blocked deployment task',
        url: 'https://github.com/o/r/issues/701',
        repo: 'o/r',
        nameWithOwner: 'o/r',
        projectItemId: 'PVTI_B1',
        itemId: 'PVTI_B1',
        isPr: false,
        relatedOpenPullRequestUrls: [],
        story: 'TDPM Console port',
        status: 'In Progress',
        nextActionDate: null,
        nextActionHour: null,
        dependedIssueUrls: [],
        labels: [],
        createdAt: '2026-06-17T00:00:00.000Z',
      },
    ];
    const fetchMock = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        return {
          ok: true,
          status: 200,
          json: async () =>
            listMatch[1] === 'workflow-blocker'
              ? { ...listPayload('workflow-blocker'), items: blockerItems }
              : listPayload(listMatch[1]),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    localStorage.setItem(
      'pv_overlay_acme',
      JSON.stringify({
        PVTI_B1: {
          ts: Date.parse('2026-06-18T23:00:00.000Z'),
          mode: 'workflow-blocker',
          done: true,
        },
      }),
    );
    window.history.replaceState(
      {},
      '',
      '/projects/acme/workflow-blocker?k=token',
    );

    const { getByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Blocked deployment task')).toBeInTheDocument();
    });
    const blockerTab = within(tabBar())
      .getByText('Workflow Blocker')
      .closest('a');
    expect(blockerTab?.querySelector('.console-tab-badge')?.textContent).toBe(
      '1',
    );
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
      fireEvent.click(await findByText('Approve & Merge'));

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

  it('renders reorder buttons in the Stories tab', async () => {
    window.history.replaceState({}, '', '/projects/acme/stories?k=token');
    const { getAllByRole, getByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getByText('snapshot: 2026-06-19T00:00:00.000Z'),
      ).toBeInTheDocument();
    });
    expect(getAllByRole('button', { name: 'Move up' }).length).toBeGreaterThan(
      0,
    );
  });

  it('does not render reorder buttons in the Triage tab', async () => {
    window.history.replaceState({}, '', '/projects/acme/triage?k=token');
    const { queryAllByRole, getByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getByText('snapshot: 2026-06-19T00:00:00.000Z'),
      ).toBeInTheDocument();
    });
    expect(queryAllByRole('button', { name: 'Move up' })).toHaveLength(0);
  });
});

const twoItemPrPayload = () => ({
  pjcode: 'acme',
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
      relatedOpenPullRequestUrls: [],
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
      relatedOpenPullRequestUrls: [],
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
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
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
    expect(await findByText('Approve & Merge')).toBeInTheDocument();
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
    expect(await findByText('Approve & Merge')).toBeInTheDocument();
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
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
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
      expect(await findByText('Approve & Merge')).toBeInTheDocument();
      expect(window.location.hash).toBe('#item/PVTI_1');

      fireEvent.click(getByText('Approve & Merge'));

      await waitFor(() => {
        expect(window.location.hash).toBe('#item/PVTI_2');
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ConsolePage scroll reset', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
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

  it('resets the window scroll position to the top when an item is opened', async () => {
    const scrollTo = jest.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    const { getByText, findByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('Approve & Merge')).toBeInTheDocument();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it('resets the window scroll position to the top on each item switch', async () => {
    const scrollTo = jest.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    const { container, getByText, findByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('Approve & Merge')).toBeInTheDocument();
    scrollTo.mockClear();

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
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it('updates the timer bar remaining time every second when an active timer is present', async () => {
    jest.useFakeTimers();
    const endsAt = new Date(Date.now() + 900 * 1000).toISOString();
    const fetchMock = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...listPayload(listMatch[1]),
            timerEndsAt: endsAt,
            timerTotalSeconds: 1800,
          }),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const { getByRole } = render(<ConsolePage />);
      await waitFor(() => expect(getByRole('progressbar')).toBeInTheDocument());
      const bar = getByRole('progressbar');
      const initialValueNow = bar.getAttribute('aria-valuenow');
      act(() => {
        jest.advanceTimersByTime(1001);
      });
      await waitFor(() => {
        expect(bar.getAttribute('aria-valuenow')).not.toBe(initialValueNow);
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ConsolePage comment composer isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
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
      if (url.includes('/api/comment')) {
        const requestBody =
          typeof init?.body === 'string'
            ? (JSON.parse(init.body) as { body: string })
            : { body: '' };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            comment: {
              author: 'you',
              body: requestBody.body,
              createdAt: '2026-06-19T02:00:00.000Z',
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('does not show a comment posted on one item under the next item', async () => {
    const {
      container,
      getByText,
      findByText,
      getByPlaceholderText,
      queryByText,
    } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('Approve & Merge')).toBeInTheDocument();

    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'first item only comment' },
    });
    fireEvent.click(getByText('Comment'));

    await waitFor(() => {
      expect(getByText('first item only comment')).toBeInTheDocument();
    });

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
    expect(queryByText('first item only comment')).toBeNull();
  });
});

describe('ConsolePage draft preservation', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
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
      void init;
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('restores the typed text when returning to a task after navigating away', async () => {
    const { container, getByText, findByText, getByPlaceholderText } = render(
      <ConsolePage />,
    );
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('Approve & Merge')).toBeInTheDocument();

    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'work in progress' },
    });

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

    swipeDetailScreen(
      detailScreen as HTMLElement,
      { clientX: 40, clientY: 100 },
      { clientX: 240, clientY: 110 },
    );
    await waitFor(() => {
      expect(getByPlaceholderText('Leave a comment…')).toHaveValue(
        'work in progress',
      );
    });
  });
});

describe('ConsolePage auto-advance tab', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
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
      fireEvent.click(await findByText('Approve & Merge'));

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
          .getByText('Todo by human')
          .closest('a')
          ?.getAttribute('aria-current'),
      ).toBe('page');
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders the gear button in the tab bar', async () => {
    const { getByText, getByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    const gearBtn = getByRole('button', { name: 'Console Settings' });
    expect(gearBtn).toBeInTheDocument();
    expect(gearBtn.closest('nav.console-tabbar')).not.toBeNull();
  });

  it('opens the settings dialog when the gear button is clicked', async () => {
    const { getByText, getByRole, queryByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    expect(queryByRole('dialog')).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Console Settings' }));
    expect(getByRole('dialog')).toBeInTheDocument();
    expect(getByRole('dialog')).toHaveAttribute(
      'aria-label',
      'Console Settings',
    );
  });

  it('saves timer settings to localStorage and closes the dialog when Save and Close is clicked', async () => {
    const { getByText, getByRole, queryByRole, getByLabelText } = render(
      <ConsolePage />,
    );
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByRole('button', { name: 'Console Settings' }));
    fireEvent.click(getByLabelText('Timer Mode'));
    fireEvent.click(getByText('Save and Close'));
    expect(queryByRole('dialog')).toBeNull();
    const stored = localStorage.getItem('tdpm-timer-settings');
    expect(stored).not.toBeNull();
    const parsed: unknown = JSON.parse(stored as string);
    expect(parsed).toMatchObject({ timerMode: true });
  });

  it('redirects to the first project with minutes > 0 when timer mode is on and pjcode is null', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({ timerMode: true, projectMinutes: { acme: 30 } }),
    );
    window.history.replaceState({}, '', '/');
    const { navigateReplace } = jest.requireMock<{
      navigateReplace: jest.Mock;
    }>('../lib/navigation');
    navigateReplace.mockClear();
    render(<ConsolePage />);
    await waitFor(() => {
      expect(navigateReplace).toHaveBeenCalledWith('/projects/acme');
    });
  });

  it('shows the stories tab badge count as the number of non-GRAY stories', async () => {
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        if (tab === 'stories') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              generatedAt: '2026-06-19T00:00:00.000Z',
              stories: [
                {
                  storyName: 'TDPM Console port',
                  storyOptionId: 'st1',
                  color: 'BLUE',
                  openItemCount: 3,
                  storyViewUrl: null,
                },
                {
                  storyName: 'regular / workflow improvement',
                  storyOptionId: 'st2',
                  color: 'GRAY',
                  openItemCount: 2,
                  storyViewUrl: null,
                },
              ],
              defaultNameWithOwner: null,
              storyOrder: [],
            }),
          };
        }
        return { ok: true, status: 200, json: async () => listPayload(tab) };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;

    const { container } = render(<ConsolePage />);

    await waitFor(() => {
      const tabs = [...container.querySelectorAll('.console-tab')];
      const storiesTab = tabs.find((el) => el.textContent?.includes('Stories'));
      expect(storiesTab).toBeTruthy();
      expect(storiesTab?.querySelector('.console-tab-badge')?.textContent).toBe(
        '1',
      );
    });
  });

  it('shows the queued tab badge count when queued items are present', async () => {
    const queuedItem = {
      number: 900,
      title: 'Queued task waiting',
      url: 'https://github.com/o/r/issues/900',
      repo: 'o/r',
      nameWithOwner: 'o/r',
      projectItemId: 'PVTI_900',
      itemId: 'PVTI_900',
      isPr: false,
      relatedOpenPullRequestUrls: [],
      story: 'TDPM Console port',
      status: 'Awaiting Workspace',
      nextActionDate: null,
      nextActionHour: null,
      dependedIssueUrls: [],
      labels: [],
      createdAt: '2026-06-17T00:00:00.000Z',
    };
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        if (tab === 'queued') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ...listPayload(''),
              agentOptions: [],
              items: [queuedItem],
            }),
          };
        }
        return { ok: true, status: 200, json: async () => listPayload(tab) };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;

    const { container } = render(<ConsolePage />);

    await waitFor(() => {
      const tabs = [...container.querySelectorAll('.console-tab')];
      const queuedTab = tabs.find((el) => el.textContent?.includes('Queued'));
      expect(queuedTab).toBeTruthy();
      expect(queuedTab?.querySelector('.console-tab-badge')?.textContent).toBe(
        '1',
      );
    });
  });

  it('reads console-story-show-gray from localStorage and shows gray stories when true', async () => {
    localStorage.setItem('console-story-show-gray', 'true');
    window.history.replaceState({}, '', '/projects/acme/stories?k=token');
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        if (tab === 'stories') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              generatedAt: '2026-06-19T00:00:00.000Z',
              stories: [
                {
                  storyName: 'TDPM Console port',
                  storyOptionId: 'st1',
                  color: 'BLUE',
                  openItemCount: 3,
                  storyViewUrl: null,
                },
                {
                  storyName: 'regular / workflow improvement',
                  storyOptionId: 'st2',
                  color: 'GRAY',
                  openItemCount: 2,
                  storyViewUrl: null,
                },
              ],
              defaultNameWithOwner: null,
              storyOrder: [],
            }),
          };
        }
        return { ok: true, status: 200, json: async () => listPayload(tab) };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;

    const { findByText } = render(<ConsolePage />);
    expect(
      await findByText('regular / workflow improvement'),
    ).toBeInTheDocument();
  });

  it('writes true to console-story-show-gray in localStorage when the toggle button is clicked', async () => {
    window.history.replaceState({}, '', '/projects/acme/stories?k=token');
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        if (tab === 'stories') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              generatedAt: '2026-06-19T00:00:00.000Z',
              stories: [
                {
                  storyName: 'TDPM Console port',
                  storyOptionId: 'st1',
                  color: 'BLUE',
                  openItemCount: 3,
                  storyViewUrl: null,
                },
                {
                  storyName: 'regular / workflow improvement',
                  storyOptionId: 'st2',
                  color: 'GRAY',
                  openItemCount: 2,
                  storyViewUrl: null,
                },
              ],
              defaultNameWithOwner: null,
              storyOrder: [],
            }),
          };
        }
        return { ok: true, status: 200, json: async () => listPayload(tab) };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;

    const { findByRole } = render(<ConsolePage />);
    const toggleBtn = await findByRole('button', { name: 'Show archived' });
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem('console-story-show-gray')).toBe('true');
  });

  it('navigates to the next project when a completing action fires after the project timer elapses', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({ timerMode: true, projectMinutes: { acme: 1, beta: 5 } }),
    );
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        return {
          ok: true,
          status: 200,
          json: async () => listPayload(listMatch[1]),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme', 'beta'] }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    jest.useFakeTimers({ now: 0 });
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      jest.setSystemTime(61 * 1000);
      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve & Merge')).toBeInTheDocument();
      fireEvent.click(getByText('Approve & Merge'));
      act(() => {
        jest.advanceTimersByTime(5100);
      });
      const { navigateAssign } = jest.requireMock<{
        navigateAssign: jest.Mock;
      }>('../lib/navigation');
      await waitFor(() => {
        expect(navigateAssign).toHaveBeenCalledWith('/projects/beta');
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ConsolePage airplane mode write guard', () => {
  const prItem = {
    number: 851,
    title: 'Add serveConsole subcommand',
    url: 'https://github.com/o/r/pull/851',
    repo: 'o/r',
    nameWithOwner: 'o/r',
    projectItemId: 'PVTI_1',
    itemId: 'PVTI_1',
    isPr: true,
    relatedOpenPullRequestUrls: [],
    story: 'TDPM Console port',
    status: 'Awaiting Quality Check',
    nextActionDate: null,
    nextActionHour: null,
    dependedIssueUrls: [],
    labels: [],
    createdAt: '2026-06-17T00:00:00.000Z',
    agent: null,
  };

  const airplaneSnapshot = {
    capturedAt: '2026-06-19T00:00:00.000Z',
    tabs: {
      acme: {
        prs: {
          items: [prItem],
          generatedAt: '2026-06-19T00:00:00.000Z',
          statusOptions: [
            { id: 's1', name: 'Awaiting Workspace', color: 'BLUE' },
          ],
          storyOptions: [
            { id: 'st1', name: 'TDPM Console port', color: 'BLUE' },
          ],
          storyColors: { 'TDPM Console port': { color: 'BLUE' } },
          stories: [],
          defaultNameWithOwner: 'o/r',
          fromCache: false,
          storyOrder: [],
        },
        'workflow-blocker': {
          items: [],
          generatedAt: '',
          statusOptions: [],
          storyOptions: [],
          storyColors: {},
          stories: [],
          defaultNameWithOwner: null,
          fromCache: false,
          storyOrder: [],
        },
        'failed-preparation': {
          items: [],
          generatedAt: '',
          statusOptions: [],
          storyOptions: [],
          storyColors: {},
          stories: [],
          defaultNameWithOwner: null,
          fromCache: false,
          storyOrder: [],
        },
        'todo-by-human': {
          items: [],
          generatedAt: '',
          statusOptions: [],
          storyOptions: [],
          storyColors: {},
          stories: [],
          defaultNameWithOwner: null,
          fromCache: false,
          storyOrder: [],
        },
        'todo-by-agent': {
          items: [],
          generatedAt: '',
          statusOptions: [],
          storyOptions: [],
          storyColors: {},
          stories: [],
          defaultNameWithOwner: null,
          fromCache: false,
          storyOrder: [],
        },
        stories: {
          items: [],
          generatedAt: '',
          statusOptions: [],
          storyOptions: [],
          storyColors: {},
          stories: [],
          defaultNameWithOwner: null,
          fromCache: false,
          storyOrder: [],
        },
      },
    },
    items: {},
    failures: [],
  };

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');

    localStorage.setItem('tdpm_airplane_mode_on', '1');

    const snapshotJson = JSON.stringify(airplaneSnapshot);
    const mockCache = {
      put: jest.fn(),
      match: jest.fn().mockResolvedValue(
        new Response(snapshotJson, {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
      delete: jest.fn(),
    };
    Object.defineProperty(global, 'caches', {
      writable: true,
      configurable: true,
      value: {
        open: jest.fn().mockResolvedValue(mockCache),
        delete: jest.fn().mockResolvedValue(true),
      },
    });

    global.fetch = jest.fn(async (url: string) => {
      if (url === '/api/features') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ airplaneMode: true }),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    Object.defineProperty(global, 'caches', {
      writable: true,
      configurable: true,
      value: undefined,
    });
  });

  it('shows an airplane mode error toast instead of enqueuing when airplane mode is on', async () => {
    const { getByText, findByText } = render(<ConsolePage />);

    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getByText('Turn off')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('Approve & Merge')).toBeInTheDocument();
    fireEvent.click(getByText('Approve & Merge'));

    await waitFor(() => {
      expect(getByText('Airplane mode')).toBeInTheDocument();
    });
    expect(getByText(/network connection/i)).toBeInTheDocument();
    expect(document.querySelector('.console-undo-toast')).toBeNull();
  });
});

describe('ConsolePage story-labeled item Delete Story button', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/todo-by-human?k=token');
    const fetchMock = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        const base = listPayload(tab);
        return {
          ok: true,
          status: 200,
          json: async () =>
            tab === 'todo-by-human'
              ? {
                  ...base,
                  items: [
                    {
                      number: 999,
                      title: 'TDPM Console port story issue',
                      url: 'https://github.com/o/r/issues/999',
                      repo: 'o/r',
                      nameWithOwner: 'o/r',
                      projectItemId: 'PVTI_ST1',
                      itemId: 'PVTI_ST1',
                      isPr: false,
                      relatedOpenPullRequestUrls: [],
                      story: 'TDPM Console port',
                      status: 'Todo by human',
                      nextActionDate: null,
                      nextActionHour: null,
                      dependedIssueUrls: [],
                      labels: ['story'],
                      createdAt: '2026-06-18T00:00:00.000Z',
                    },
                  ],
                }
              : base,
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('shows Delete Story in the danger zone when a story-labeled item matching a story entry is selected', async () => {
    const { getByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('TDPM Console port story issue')).toBeInTheDocument();
    });
    fireEvent.click(getByText('TDPM Console port story issue'));
    await waitFor(() => {
      expect(getByText('⚠')).toBeInTheDocument();
    });
    fireEvent.click(getByText('⚠'));
    await waitFor(() => {
      expect(getByText('Delete Story')).toBeInTheDocument();
    });
  });

  it('does not show Delete Story in the danger zone when the selected item has no story label', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        return {
          ok: true,
          status: 200,
          json: async () => listPayload(listMatch[1]),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByText, queryByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getByText('Notify finished issue preparation'),
      ).toBeInTheDocument();
    });
    fireEvent.click(getByText('Notify finished issue preparation'));
    await waitFor(() => {
      expect(getByText('⚠')).toBeInTheDocument();
    });
    fireEvent.click(getByText('⚠'));
    expect(queryByText('Delete Story')).toBeNull();
  });
});
