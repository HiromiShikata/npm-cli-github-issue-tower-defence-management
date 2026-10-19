import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react';
import type { IssueCreateParams } from '../components/layout/IssueCreateModalDialog';
import { CONSOLE_TAB_REFRESH_INTERVAL_MS } from '../hooks/useConsoleTabData';
import * as consoleApi from '../lib/consoleApi';
import { ACTION_TOAST_DELAY_MS } from '../logic/actionToast';
import { colorFromEnum } from '../logic/colors';
import { overlayStorageKey } from '../logic/overlay';
import {
  type AttachmentSubmissionProgress,
  attachmentSubmissionParamsChanged,
  buildAttachmentSubmissionFailureMessage,
  ConsolePage,
  createEmptyAttachmentSubmissionProgress,
  createIssueWithAttachments,
} from './ConsolePage';

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
  navigatePush: jest.fn(),
  navigateReplaceState: jest.fn(),
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
            status: 'Awaiting Owner',
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

const actionableCountsWithBetaTodoByHumanItem = {
  todoByHumanCounts: { beta: 1 },
  awaitingOwnerCounts: {},
};

const installFetch = (
  projectsPayload: Record<string, unknown> = { pjcodes: ['acme'] },
): void => {
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
        json: async () => projectsPayload,
      };
    }
    if (url.startsWith('/api/projectreadmeconfig')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ maximumPreparingIssuesCount: 3 }),
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
    expect(within(tabBar()).getByText('Awaiting Owner')).toBeInTheDocument();
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
                      status: 'Awaiting Owner',
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
                        status: 'Awaiting Owner',
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
                  status: 'Awaiting Owner',
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
    expect(chip?.textContent).toBe('Awaiting Owner');
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
    const genInfo = container.querySelector('.console-tab-geninfo');
    expect(genInfo).toBeInTheDocument();
    expect(genInfo?.getAttribute('title')).toBe('2026-06-19T00:00:00.000Z');
    expect(genInfo?.textContent).toMatch(/^snapshot: \d+[smhd] ago$/);
  });

  it('shows a cancellable toast when Approve & Merge is clicked', async () => {
    jest.useFakeTimers();
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      expect(
        within(tabBar())
          .getByText('Awaiting Owner')
          .closest('a')
          ?.querySelector('.console-tab-badge')?.textContent,
      ).toBe('1');

      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve & Merge')).toBeInTheDocument();
      fireEvent.click(getByText('Approve & Merge'));

      expect(getByText('Approved & Merged — PR o/r#851')).toBeInTheDocument();
      expect(getByText('Undo')).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('hides a processed item from the list immediately when ok & Awaiting Workspace is clicked, without waiting for the 5-second commit', async () => {
    jest.useFakeTimers();
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      expect(
        within(tabBar())
          .getByText('Awaiting Owner')
          .closest('a')
          ?.querySelector('.console-tab-badge')?.textContent,
      ).toBe('1');

      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('ok & Awaiting Workspace')).toBeInTheDocument();
      fireEvent.click(getByText('ok & Awaiting Workspace'));

      await waitFor(() => {
        expect(
          within(tabBar())
            .getByText('Awaiting Owner')
            .closest('a')
            ?.querySelector('.console-tab-badge')?.textContent,
        ).toBe('0');
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('hides a processed item from the prs list immediately when Approve & Merge is clicked, without waiting for the 5-second commit', async () => {
    jest.useFakeTimers();
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      expect(
        within(tabBar())
          .getByText('Awaiting Owner')
          .closest('a')
          ?.querySelector('.console-tab-badge')?.textContent,
      ).toBe('1');

      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve & Merge')).toBeInTheDocument();
      fireEvent.click(getByText('Approve & Merge'));

      await waitFor(() => {
        expect(
          within(tabBar())
            .getByText('Awaiting Owner')
            .closest('a')
            ?.querySelector('.console-tab-badge')?.textContent,
        ).toBe('0');
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('hides a processed item from the todo-by-human list immediately when Close is clicked, without waiting for the 5-second commit', async () => {
    jest.useFakeTimers();
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });

      fireEvent.click(getByText('Todo by human'));
      await waitFor(() => {
        expect(
          getByText('Notify finished issue preparation'),
        ).toBeInTheDocument();
      });

      fireEvent.click(getByText('Notify finished issue preparation'));
      expect(await findByText('Close')).toBeInTheDocument();
      fireEvent.click(getByText('Close'));

      await waitFor(() => {
        expect(within(tabBar()).queryByText('Todo by human')).toBeNull();
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
          .getByText('Awaiting Owner')
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
    expect(tabs.queryByText('Awaiting Owner')).not.toBeNull();
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

  it('restores an item when a stale done overlay entry predates the snapshot and the item is still present (self-heal)', async () => {
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
  });

  it('restores a todo-by-human item when the snapshot was generated after the overlay entry and the item is still present (self-heal)', async () => {
    localStorage.setItem(
      'pv_overlay_acme',
      JSON.stringify({
        PVTI_2: {
          ts: Date.parse('2026-06-18T00:00:00.000Z'),
          mode: 'todo-by-human',
          done: true,
        },
      }),
    );
    window.history.replaceState({}, '', '/projects/acme/todo-by-human?k=token');

    const { getByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getByText('Notify finished issue preparation'),
      ).toBeInTheDocument();
    });
  });

  it('keeps a successfully-processed item hidden after a newer snapshot arrives when the item has left the snapshot', async () => {
    localStorage.setItem(
      'pv_overlay_acme',
      JSON.stringify({
        PVTI_1: {
          ts: Date.parse('2026-06-18T23:00:00.000Z'),
          mode: 'prs',
          done: true,
        },
      }),
    );
    const fetchMock = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        return {
          ok: true,
          status: 200,
          json: async () =>
            listMatch[1] === 'prs'
              ? { ...listPayload('prs'), items: [] }
              : listPayload(listMatch[1]),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');

    const { queryByText } = render(<ConsolePage />);
    await waitFor(() => {
      const awaitingOwnerTab = within(tabBar())
        .getByText('Awaiting Owner')
        .closest('a');
      expect(
        awaitingOwnerTab?.querySelector('.console-tab-badge')?.textContent,
      ).toBe('0');
    });
    expect(queryByText('Add serveConsole subcommand')).toBeNull();
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

  it('shows a retry button in the error toast that re-attempts the failed action', async () => {
    let postCallCount = 0;
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
          postCallCount++;
          if (postCallCount === 1) {
            return {
              ok: false,
              status: 500,
              text: async () => JSON.stringify({ error: 'merge failed' }),
            };
          }
          return { ok: true, status: 200, json: async () => ({}) };
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
      const { getByText, findByText, container } = render(<ConsolePage />);
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

      expect(getByText(/^Operation failed:/)).toBeInTheDocument();

      const retryButton = container.querySelector('.console-error-toast-retry');
      expect(retryButton).not.toBeNull();
      if (retryButton === null)
        throw new Error('retryButton should not be null');

      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(container.querySelector('.console-error-toast')).toBeNull();
      });
      expect(postCallCount).toBe(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders reorder buttons in the Stories tab', async () => {
    window.history.replaceState({}, '', '/projects/acme/stories?k=token');
    const { getAllByRole, container } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        container.querySelector(
          '.console-tab-geninfo[title="2026-06-19T00:00:00.000Z"]',
        ),
      ).not.toBeNull();
    });
    expect(getAllByRole('button', { name: 'Move up' }).length).toBeGreaterThan(
      0,
    );
  });

  it('shows the detail screen for an item that exists only inside a story entry nested items array while the stories tab is active', async () => {
    window.history.replaceState(
      {},
      '',
      '/projects/acme/stories?k=token#item/PVTI_NESTED',
    );
    const fetchMock = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        const base = listPayload(tab);
        return {
          ok: true,
          status: 200,
          json: async () =>
            tab === 'stories'
              ? {
                  ...base,
                  stories: [
                    {
                      storyName: 'TDPM Console port',
                      storyOptionId: 'st1',
                      color: 'BLUE',
                      openItemCount: 1,
                      storyViewUrl: null,
                      items: [
                        {
                          number: 777,
                          title: 'Nested story task not in flat items',
                          url: 'https://github.com/o/r/issues/777',
                          repo: 'o/r',
                          nameWithOwner: 'o/r',
                          projectItemId: 'PVTI_NESTED',
                          itemId: 'PVTI_NESTED',
                          isPr: false,
                          relatedOpenPullRequestUrls: [],
                          story: 'TDPM Console port',
                          status: 'Done',
                          agent: null,
                          nextActionDate: null,
                          nextActionHour: null,
                          dependedIssueUrls: [],
                          labels: [],
                          createdAt: '2026-06-18T00:00:00.000Z',
                        },
                      ],
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

    const { getByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getByText('Nested story task not in flat items'),
      ).toBeInTheDocument();
    });
    expect(document.querySelector('.console-detail-screen')).not.toBeNull();
    expect(document.querySelector('.console-story-list-container')).toBeNull();
  });

  it('does not render reorder buttons in the Triage tab', async () => {
    window.history.replaceState({}, '', '/projects/acme/triage?k=token');
    const { queryAllByRole, container } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        container.querySelector(
          '.console-tab-geninfo[title="2026-06-19T00:00:00.000Z"]',
        ),
      ).not.toBeNull();
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
      status: 'Awaiting Owner',
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
      status: 'Awaiting Owner',
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

  it('stays on the list when ok & Awaiting Workspace is clicked from the list', async () => {
    jest.useFakeTimers();
    try {
      const { getAllByRole } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getAllByRole('button', { name: 'ok & Awaiting Workspace' }),
        ).toHaveLength(2);
      });
      expect(window.location.hash).toBe('');

      fireEvent.click(
        getAllByRole('button', { name: 'ok & Awaiting Workspace' })[0],
      );

      act(() => {
        jest.advanceTimersByTime(5100);
      });

      await waitFor(() => {
        expect(window.location.hash).toBe('');
      });
      expect(document.querySelector('.console-detail-screen')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('removes the acted item from the list immediately when ok & Awaiting Workspace is clicked from the list', async () => {
    jest.useFakeTimers();
    try {
      const { getAllByRole } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getAllByRole('button', { name: 'ok & Awaiting Workspace' }),
        ).toHaveLength(2);
      });

      fireEvent.click(
        getAllByRole('button', { name: 'ok & Awaiting Workspace' })[0],
      );

      await waitFor(() => {
        expect(
          getAllByRole('button', { name: 'ok & Awaiting Workspace' }),
        ).toHaveLength(1);
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('restores the item when Undo is clicked after ok & Awaiting Workspace from the list', async () => {
    jest.useFakeTimers();
    try {
      const { getAllByRole, getByRole } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getAllByRole('button', { name: 'ok & Awaiting Workspace' }),
        ).toHaveLength(2);
      });

      fireEvent.click(
        getAllByRole('button', { name: 'ok & Awaiting Workspace' })[0],
      );

      await waitFor(() => {
        expect(
          getAllByRole('button', { name: 'ok & Awaiting Workspace' }),
        ).toHaveLength(1);
      });

      fireEvent.click(getByRole('button', { name: 'Undo' }));

      await waitFor(() => {
        expect(
          getAllByRole('button', { name: 'ok & Awaiting Workspace' }),
        ).toHaveLength(2);
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

const AWAITING_OWNER_LIST_VISIBILITY_SWITCH_NAME =
  'Show executive summary & action button on Awaiting Owner list (all projects)';
const AWAITING_OWNER_LIST_VISIBILITY_COMMENT_BODY =
  'Needs owner decision on rollout plan.';

describe('ConsolePage awaiting owner list visibility setting', () => {
  const installFetchForVisibilitySetting = (): void => {
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
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      if (url.startsWith('/api/projectreadmeconfig')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ maximumPreparingIssuesCount: 3 }),
        };
      }
      if (url.startsWith('/api/comments')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            comments: [
              {
                author: 'bot',
                body: AWAITING_OWNER_LIST_VISIBILITY_COMMENT_BODY,
                createdAt: '2026-06-19T00:00:00.000Z',
              },
            ],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  };

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
    installFetchForVisibilitySetting();
  });

  it('shows the new switch as on by default when Max settings is opened for the first time', async () => {
    const { getByText, getByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByRole('button', { name: 'Open max settings' }));
    await waitFor(() => {
      expect(
        getByRole('switch', {
          name: AWAITING_OWNER_LIST_VISIBILITY_SWITCH_NAME,
        }),
      ).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('shows the executive summary text and the ok & Awaiting Workspace button for every prs tab item while the setting is on (default, never changed)', async () => {
    const { getAllByRole, getAllByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getAllByRole('button', { name: 'ok & Awaiting Workspace' }),
      ).toHaveLength(2);
    });
    await waitFor(() => {
      expect(
        getAllByText(AWAITING_OWNER_LIST_VISIBILITY_COMMENT_BODY),
      ).toHaveLength(2);
    });
  });

  it('turning the switch off and saving removes the executive summary and the ok & Awaiting Workspace button from the prs tab list, persists the setting, and keeps the title clickable', async () => {
    const {
      getByText,
      getByRole,
      getAllByRole,
      queryAllByRole,
      queryByRole,
      queryAllByText,
      getByLabelText,
    } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getAllByRole('button', { name: 'ok & Awaiting Workspace' }),
      ).toHaveLength(2);
    });

    fireEvent.click(getByRole('button', { name: 'Open max settings' }));
    const toggle = await waitFor(() =>
      getByRole('switch', { name: AWAITING_OWNER_LIST_VISIBILITY_SWITCH_NAME }),
    );
    fireEvent.click(toggle);
    fireEvent.click(getByLabelText('Save max settings'));

    await waitFor(() => {
      expect(queryByRole('dialog', { name: 'Max settings' })).toBeNull();
    });

    const stored = localStorage.getItem(
      'tdpm-awaiting-owner-list-visibility-settings',
    );
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string)).toEqual({
      showExecutiveSummaryAndActionButton: false,
    });

    await waitFor(() => {
      expect(
        queryAllByRole('button', { name: 'ok & Awaiting Workspace' }),
      ).toHaveLength(0);
    });
    expect(
      queryAllByText(AWAITING_OWNER_LIST_VISIBILITY_COMMENT_BODY),
    ).toHaveLength(0);
    expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();

    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(window.location.hash).toBe('#item/PVTI_1');
  });

  it('keeps the todo-by-human tab list showing zero ok & Awaiting Workspace buttons when the setting is off (no regression on other tabs)', async () => {
    localStorage.setItem(
      'tdpm-awaiting-owner-list-visibility-settings',
      JSON.stringify({ showExecutiveSummaryAndActionButton: false }),
    );
    window.history.replaceState({}, '', '/projects/acme/todo-by-human?k=token');
    installFetch();
    const { getByText, queryAllByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getByText('Notify finished issue preparation'),
      ).toBeInTheDocument();
    });
    expect(
      queryAllByRole('button', { name: 'ok & Awaiting Workspace' }),
    ).toHaveLength(0);
  });

  it('shows the switch still off after reopening Max settings on a fresh render (simulated page reload) when the setting was saved off', async () => {
    localStorage.setItem(
      'tdpm-awaiting-owner-list-visibility-settings',
      JSON.stringify({ showExecutiveSummaryAndActionButton: false }),
    );
    const { getByText, getByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByRole('button', { name: 'Open max settings' }));
    await waitFor(() => {
      expect(
        getByRole('switch', {
          name: AWAITING_OWNER_LIST_VISIBILITY_SWITCH_NAME,
        }),
      ).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('discards an unsaved toggle when Max settings is closed with the close button, reverting to on when reopened', async () => {
    const { getByText, getByRole, getByLabelText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByRole('button', { name: 'Open max settings' }));
    const toggle = await waitFor(() =>
      getByRole('switch', { name: AWAITING_OWNER_LIST_VISIBILITY_SWITCH_NAME }),
    );
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(getByLabelText('Close max settings'));

    fireEvent.click(getByRole('button', { name: 'Open max settings' }));
    await waitFor(() => {
      expect(
        getByRole('switch', {
          name: AWAITING_OWNER_LIST_VISIBILITY_SWITCH_NAME,
        }),
      ).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('keeps the toggle off and Max settings open with an error when turning the switch off and the max settings save fails', async () => {
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
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      if (url.startsWith('/api/projectreadmeconfig')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ maximumPreparingIssuesCount: 3 }),
        };
      }
      if (url.startsWith('/api/comments')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            comments: [
              {
                author: 'bot',
                body: AWAITING_OWNER_LIST_VISIBILITY_COMMENT_BODY,
                createdAt: '2026-06-19T00:00:00.000Z',
              },
            ],
          }),
        };
      }
      if (url === '/api/projectsettings') {
        return {
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByText, getByRole, getByLabelText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });

    fireEvent.click(getByRole('button', { name: 'Open max settings' }));
    const toggle = await waitFor(() =>
      getByRole('switch', { name: AWAITING_OWNER_LIST_VISIBILITY_SWITCH_NAME }),
    );
    fireEvent.click(toggle);
    fireEvent.click(getByLabelText('Save max settings'));

    await waitFor(() => {
      expect(getByRole('alert').textContent).toBe('Internal Server Error');
    });

    expect(getByRole('dialog', { name: 'Max settings' })).toBeInTheDocument();
    expect(
      getByRole('switch', { name: AWAITING_OWNER_LIST_VISIBILITY_SWITCH_NAME }),
    ).toHaveAttribute('aria-checked', 'false');
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

  it('restores the draft present at click time when Undo is clicked after Comment & Awaiting Workspace, once the task is reopened', async () => {
    jest.useFakeTimers();
    try {
      const { container, getByText, findByText, getByPlaceholderText } = render(
        <ConsolePage />,
      );
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });

      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve & Merge')).toBeInTheDocument();

      fireEvent.change(getByPlaceholderText('Leave a comment…'), {
        target: { value: 'should survive undo' },
      });
      fireEvent.click(getByText('Comment & Awaiting Workspace'));

      await waitFor(() => {
        expect(window.location.hash).toBe('#item/PVTI_2');
      });

      fireEvent.click(getByText('Undo'));

      act(() => {
        jest.advanceTimersByTime(ACTION_TOAST_DELAY_MS + 1000);
      });

      const postCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([, init]: [string, RequestInit | undefined]) =>
          init?.method === 'POST',
      );
      expect(postCalls.length).toBe(0);

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

      await waitFor(() => {
        expect(getByPlaceholderText('Leave a comment…')).toHaveValue(
          'should survive undo',
        );
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('leaves the comment input empty once the task is reopened after Comment & Awaiting Workspace commits for real without Undo', async () => {
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
      if (init?.method === 'POST' && url.endsWith('/api/comment')) {
        const requestBody = JSON.parse(String(init.body)) as { body: string };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            comment: {
              id: 7,
              author: 'you',
              body: requestBody.body,
              createdAt: '2026-06-19T02:00:00.000Z',
            },
          }),
        };
      }
      if (init?.method === 'POST' && url.endsWith('/api/triage')) {
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    jest.useFakeTimers();
    try {
      const { getByText, findByText, getByPlaceholderText } = render(
        <ConsolePage />,
      );
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });

      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve & Merge')).toBeInTheDocument();

      fireEvent.change(getByPlaceholderText('Leave a comment…'), {
        target: { value: 'posted for real' },
      });
      fireEvent.click(getByText('Comment & Awaiting Workspace'));

      await waitFor(() => {
        expect(window.location.hash).toBe('#item/PVTI_2');
      });

      act(() => {
        jest.advanceTimersByTime(ACTION_TOAST_DELAY_MS - 100);
      });
      await act(async () => {
        jest.advanceTimersByTime(200);
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(
          fetchMock.mock.calls.some(
            ([callUrl, callInit]) =>
              String(callUrl).endsWith('/api/comment') &&
              (callInit as RequestInit | undefined)?.method === 'POST',
          ),
        ).toBe(true);
      });

      await act(async () => {
        window.location.hash = '#item/PVTI_1';
        window.dispatchEvent(new Event('hashchange'));
      });
      await waitFor(() => {
        expect(window.location.hash).toBe('#item/PVTI_1');
      });

      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(getByPlaceholderText('Leave a comment…')).toHaveValue('');
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ConsolePage comment draft reload persistence', () => {
  const installDraftReloadFetch = (): void => {
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
  };

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
    installDraftReloadFetch();
  });

  it('shows the same unsent draft text for the task that held it after the page is unmounted and remounted (simulated reload)', async () => {
    const { getByText, findByText, getByPlaceholderText, unmount } = render(
      <ConsolePage />,
    );
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('Approve & Merge')).toBeInTheDocument();

    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'typed just before the page reloaded' },
    });

    unmount();
    installDraftReloadFetch();

    const reloaded = render(<ConsolePage />);
    expect(await reloaded.findByText('Approve & Merge')).toBeInTheDocument();
    expect(reloaded.getByPlaceholderText('Leave a comment…')).toHaveValue(
      'typed just before the page reloaded',
    );
  });

  it("keeps each task's own unsent draft separate, for two tasks each holding a different draft, after a simulated reload", async () => {
    const { container, getByText, findByText, getByPlaceholderText, unmount } =
      render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('Approve & Merge')).toBeInTheDocument();

    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'draft for task one' },
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

    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'draft for task two' },
    });

    unmount();
    installDraftReloadFetch();

    const reloaded = render(<ConsolePage />);
    await waitFor(() => {
      expect(reloaded.getByPlaceholderText('Leave a comment…')).toHaveValue(
        'draft for task two',
      );
    });

    const reloadedDetailScreen = reloaded.container.querySelector(
      '.console-detail-screen',
    );
    expect(reloadedDetailScreen).not.toBeNull();
    swipeDetailScreen(
      reloadedDetailScreen as HTMLElement,
      { clientX: 40, clientY: 100 },
      { clientX: 240, clientY: 110 },
    );
    await waitFor(() => {
      expect(window.location.hash).toBe('#item/PVTI_1');
    });
    expect(reloaded.getByPlaceholderText('Leave a comment…')).toHaveValue(
      'draft for task one',
    );
  });

  it('shows an empty comment field for a task that never held an unsent draft', async () => {
    const { getByText, findByText, getByPlaceholderText } = render(
      <ConsolePage />,
    );
    await waitFor(() => {
      expect(
        getByText('Add server-side console API handlers'),
      ).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add server-side console API handlers'));
    expect(await findByText('Approve & Merge')).toBeInTheDocument();

    expect(getByPlaceholderText('Leave a comment…')).toHaveValue('');
  });

  it('does not restore a draft after a simulated reload once its comment was submitted successfully', async () => {
    const { getByText, findByText, getByPlaceholderText, unmount } = render(
      <ConsolePage />,
    );
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('Approve & Merge')).toBeInTheDocument();

    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'about to be submitted' },
    });
    fireEvent.click(getByText('Comment'));

    await waitFor(() => {
      expect(getByText('about to be submitted')).toBeInTheDocument();
    });

    unmount();
    installDraftReloadFetch();

    const reloaded = render(<ConsolePage />);
    await waitFor(() => {
      expect(reloaded.getByText('Approve & Merge')).toBeInTheDocument();
    });
    expect(reloaded.getByPlaceholderText('Leave a comment…')).toHaveValue('');
  });

  it('does not retain typed text in the task-creation dialog after a simulated reload', async () => {
    window.history.replaceState({}, '', '/projects/acme/stories?k=token');
    const storiesTabPayload = () => ({
      ...listPayload('stories'),
      defaultNameWithOwner: 'o/r',
    });
    const installStoriesFetch = (): void => {
      const fetchMock = jest.fn(async (url: string) => {
        const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
        if (listMatch !== null) {
          const tab = listMatch[1];
          return {
            ok: true,
            status: 200,
            json: async () =>
              tab === 'stories' ? storiesTabPayload() : listPayload(tab),
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
    };
    installStoriesFetch();

    const { getByRole, getByPlaceholderText, queryByRole, unmount } = render(
      <ConsolePage />,
    );

    await waitFor(() => {
      expect(getByRole('button', { name: '+ Add task' })).toBeInTheDocument();
    });

    fireEvent.click(getByRole('button', { name: '+ Add task' }));
    await waitFor(() => {
      expect(
        getByRole('dialog', { name: 'Add task to TDPM Console port' }),
      ).toBeInTheDocument();
    });

    fireEvent.change(getByPlaceholderText('Issue title'), {
      target: { value: 'typed into the task creation dialog' },
    });
    fireEvent.click(getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(
        queryByRole('dialog', { name: 'Add task to TDPM Console port' }),
      ).toBeNull();
    });

    unmount();
    installStoriesFetch();

    const reloaded = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        reloaded.getByRole('button', { name: '+ Add task' }),
      ).toBeInTheDocument();
    });
    fireEvent.click(reloaded.getByRole('button', { name: '+ Add task' }));
    await waitFor(() => {
      expect(
        reloaded.getByRole('dialog', { name: 'Add task to TDPM Console port' }),
      ).toBeInTheDocument();
    });
    expect(reloaded.getByPlaceholderText('Issue title')).toHaveValue('');
  });

  it('continues to accept typed comment text with no error indicator, and still shows that text after navigating to another task and back within the page, when localStorage.setItem throws', async () => {
    const { container, getByText, findByText, getByPlaceholderText } = render(
      <ConsolePage />,
    );
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add serveConsole subcommand'));
    expect(await findByText('Approve & Merge')).toBeInTheDocument();

    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('simulated failure');
      });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      fireEvent.change(getByPlaceholderText('Leave a comment…'), {
        target: { value: 'typed while storage writes are throwing' },
      });

      expect(getByPlaceholderText('Leave a comment…')).toHaveValue(
        'typed while storage writes are throwing',
      );
      expect(container.querySelector('.console-error-toast')).toBeNull();
      expect(container.querySelector('.console-composer-error')).toBeNull();
      expect(getByText('Approve & Merge')).toBeInTheDocument();

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
        expect(window.location.hash).toBe('#item/PVTI_1');
      });

      expect(getByPlaceholderText('Leave a comment…')).toHaveValue(
        'typed while storage writes are throwing',
      );
    } finally {
      setItemSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

describe('ConsolePage auto-advance tab', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
    installFetch();
  });

  it('auto-advances to the next non-empty tab on the right after the active tab is driven to zero', async () => {
    window.history.replaceState({}, '', '/projects/acme/todo-by-human?k=token');
    jest.useFakeTimers();
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getByText('Notify finished issue preparation'),
        ).toBeInTheDocument();
      });

      fireEvent.click(getByText('Notify finished issue preparation'));
      fireEvent.click(await findByText('Close'));

      act(() => {
        jest.advanceTimersByTime(5100);
      });

      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      expect(
        within(tabBar())
          .getByText('Awaiting Owner')
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
    const gearBtn = getByRole('button', { name: 'Settings' });
    expect(gearBtn).toBeInTheDocument();
    expect(gearBtn.closest('nav.console-tabbar')).not.toBeNull();
  });

  it('opens the settings dialog when the gear button is clicked', async () => {
    const { getByText, getByRole, queryByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    expect(queryByRole('dialog')).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Settings' }));
    expect(getByRole('dialog')).toBeInTheDocument();
    expect(getByRole('dialog')).toHaveAttribute('aria-label', 'Settings');
  });

  it('renders the max settings button in the tab bar', async () => {
    const { getByText, getByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    const maxBtn = getByRole('button', { name: 'Open max settings' });
    expect(maxBtn).toBeInTheDocument();
    expect(maxBtn.closest('nav.console-tabbar')).not.toBeNull();
  });

  it('renders the max settings button with the gear icon', async () => {
    const { getByText, getByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    const maxBtn = getByRole('button', { name: 'Open max settings' });
    expect(maxBtn.textContent?.trim()).toBe('⚙');
  });

  it('shows the max settings button even when no project is selected', async () => {
    window.history.replaceState({}, '', '/');
    const { getByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getByRole('button', { name: 'Open max settings' }),
      ).toBeInTheDocument();
    });
  });

  it('opens the max settings dialog when the max settings button is clicked', async () => {
    const { getByText, getByRole, queryByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    expect(queryByRole('dialog', { name: 'Max settings' })).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Open max settings' }));
    await waitFor(() => {
      expect(getByRole('dialog', { name: 'Max settings' })).toBeInTheDocument();
    });
  });

  it('saves timer settings to localStorage and closes the dialog when Save and Close is clicked', async () => {
    const { getByText, getByRole, queryByRole, getByLabelText } = render(
      <ConsolePage />,
    );
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByRole('button', { name: 'Settings' }));
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
    installFetch({
      pjcodes: ['acme'],
      actionableCounts: {
        todoByHumanCounts: { acme: 1 },
        awaitingOwnerCounts: {},
      },
    });
    window.history.replaceState({}, '', '/');
    const { navigateReplaceState } = jest.requireMock<{
      navigateReplaceState: jest.Mock;
    }>('../lib/navigation');
    navigateReplaceState.mockClear();
    render(<ConsolePage />);
    await waitFor(() => {
      expect(navigateReplaceState).toHaveBeenCalledWith(
        '/projects/acme/todo-by-human',
      );
    });
  });

  describe('initial project selection when timer mode is on and no project is selected', () => {
    type ProjectsPayload = Record<string, unknown>;

    const navigationPathsAfterProjectListLoads = async (
      projectMinutes: Record<string, number>,
      projectsPayload: ProjectsPayload,
    ): Promise<string[]> => {
      localStorage.setItem(
        'tdpm-timer-settings',
        JSON.stringify({ timerMode: true, projectMinutes }),
      );
      window.history.replaceState({}, '', '/');
      let projectListServed = false;
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
          projectListServed = true;
          return {
            ok: true,
            status: 200,
            json: async () => projectsPayload,
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ body: '# body' }),
        };
      }) as unknown as typeof fetch;
      const { navigateReplaceState } = jest.requireMock<{
        navigateReplaceState: jest.Mock;
      }>('../lib/navigation');
      navigateReplaceState.mockClear();
      const { unmount } = render(<ConsolePage />);
      await waitFor(() => {
        expect(projectListServed).toBe(true);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      unmount();
      const navigatedPaths = navigateReplaceState.mock.calls.map(
        (call: [string]) => call[0],
      );
      return [...new Set(navigatedPaths)];
    };

    it('selects the first candidate project holding a positive todo-by-human or awaiting-owner count and skips candidates whose counts are zero or absent', async () => {
      const scenarios: {
        name: string;
        projectMinutes: Record<string, number>;
        projectsPayload: ProjectsPayload;
        expectedPaths: string[];
      }[] = [
        {
          name: 'the first candidate has zero counts and the second has a positive todo-by-human count',
          projectMinutes: { acme: 30, beta: 30 },
          projectsPayload: {
            pjcodes: ['acme', 'beta'],
            actionableCounts: {
              todoByHumanCounts: { acme: 0, beta: 2 },
              awaitingOwnerCounts: { acme: 0, beta: 0 },
            },
          },
          expectedPaths: ['/projects/beta/todo-by-human'],
        },
        {
          name: 'the first candidate has zero counts and the second has only a positive awaiting-owner count',
          projectMinutes: { acme: 30, beta: 30 },
          projectsPayload: {
            pjcodes: ['acme', 'beta'],
            actionableCounts: {
              todoByHumanCounts: { acme: 0, beta: 0 },
              awaitingOwnerCounts: { acme: 0, beta: 3 },
            },
          },
          expectedPaths: ['/projects/beta/todo-by-human'],
        },
        {
          name: 'the first candidate is absent from both count records',
          projectMinutes: { acme: 30, beta: 30 },
          projectsPayload: {
            pjcodes: ['acme', 'beta'],
            actionableCounts: {
              todoByHumanCounts: { beta: 1 },
              awaitingOwnerCounts: {},
            },
          },
          expectedPaths: ['/projects/beta/todo-by-human'],
        },
        {
          name: 'the first candidate has a positive todo-by-human count and the second also qualifies',
          projectMinutes: { acme: 30, beta: 30 },
          projectsPayload: {
            pjcodes: ['acme', 'beta'],
            actionableCounts: {
              todoByHumanCounts: { acme: 1, beta: 1 },
              awaitingOwnerCounts: {},
            },
          },
          expectedPaths: ['/projects/acme/todo-by-human'],
        },
        {
          name: 'the first candidate has only a positive awaiting-owner count and the second has a positive todo-by-human count',
          projectMinutes: { acme: 30, beta: 30 },
          projectsPayload: {
            pjcodes: ['acme', 'beta'],
            actionableCounts: {
              todoByHumanCounts: { acme: 0, beta: 1 },
              awaitingOwnerCounts: { acme: 1, beta: 0 },
            },
          },
          expectedPaths: ['/projects/acme/todo-by-human'],
        },
        {
          name: 'the first candidate has a positive count but zero minutes',
          projectMinutes: { acme: 0, beta: 30 },
          projectsPayload: {
            pjcodes: ['acme', 'beta'],
            actionableCounts: {
              todoByHumanCounts: { acme: 1, beta: 1 },
              awaitingOwnerCounts: {},
            },
          },
          expectedPaths: ['/projects/beta/todo-by-human'],
        },
        {
          name: 'only the third candidate has a positive count',
          projectMinutes: { acme: 30, beta: 30, gamma: 30 },
          projectsPayload: {
            pjcodes: ['acme', 'beta', 'gamma'],
            actionableCounts: {
              todoByHumanCounts: { acme: 0, beta: 0, gamma: 4 },
              awaitingOwnerCounts: { acme: 0, beta: 0, gamma: 0 },
            },
          },
          expectedPaths: ['/projects/gamma/todo-by-human'],
        },
      ];

      const observed: { name: string; navigatedPaths: string[] }[] = [];
      for (const scenario of scenarios) {
        observed.push({
          name: scenario.name,
          navigatedPaths: await navigationPathsAfterProjectListLoads(
            scenario.projectMinutes,
            scenario.projectsPayload,
          ),
        });
      }

      expect(observed).toEqual(
        scenarios.map((scenario) => ({
          name: scenario.name,
          navigatedPaths: scenario.expectedPaths,
        })),
      );
    });

    it('selects no project when no candidate has both positive minutes and a positive todo-by-human or awaiting-owner count', async () => {
      const scenarios: {
        name: string;
        projectMinutes: Record<string, number>;
        projectsPayload: ProjectsPayload;
      }[] = [
        {
          name: 'every candidate has zero todo-by-human and zero awaiting-owner counts',
          projectMinutes: { acme: 30, beta: 30 },
          projectsPayload: {
            pjcodes: ['acme', 'beta'],
            actionableCounts: {
              todoByHumanCounts: { acme: 0, beta: 0 },
              awaitingOwnerCounts: { acme: 0, beta: 0 },
            },
          },
        },
        {
          name: 'both count records are empty',
          projectMinutes: { acme: 30, beta: 30 },
          projectsPayload: {
            pjcodes: ['acme', 'beta'],
            actionableCounts: {
              todoByHumanCounts: {},
              awaitingOwnerCounts: {},
            },
          },
        },
        {
          name: 'the response carries no actionableCounts',
          projectMinutes: { acme: 30, beta: 30 },
          projectsPayload: { pjcodes: ['acme', 'beta'] },
        },
        {
          name: 'the response carries a null actionableCounts',
          projectMinutes: { acme: 30, beta: 30 },
          projectsPayload: {
            pjcodes: ['acme', 'beta'],
            actionableCounts: null,
          },
        },
        {
          name: 'every candidate has a positive count but zero minutes',
          projectMinutes: { acme: 0, beta: 0 },
          projectsPayload: {
            pjcodes: ['acme', 'beta'],
            actionableCounts: {
              todoByHumanCounts: { acme: 1, beta: 1 },
              awaitingOwnerCounts: { acme: 1, beta: 1 },
            },
          },
        },
      ];

      const observed: { name: string; navigatedPaths: string[] }[] = [];
      for (const scenario of scenarios) {
        observed.push({
          name: scenario.name,
          navigatedPaths: await navigationPathsAfterProjectListLoads(
            scenario.projectMinutes,
            scenario.projectsPayload,
          ),
        });
      }

      expect(observed).toEqual(
        scenarios.map((scenario) => ({
          name: scenario.name,
          navigatedPaths: [],
        })),
      );
    });

    it('selects a candidate project when a background project-list re-fetch with unchanged project codes and minutes brings a positive todo-by-human or awaiting-owner count after an initial load that selected no project', async () => {
      const projectMinutes = { acme: 30, beta: 30 };
      const pjcodes = ['acme', 'beta'];
      const scenarios: {
        name: string;
        refetchedProjectsPayload: ProjectsPayload;
      }[] = [
        {
          name: 'the re-fetch gives the second candidate a positive todo-by-human count',
          refetchedProjectsPayload: {
            pjcodes,
            actionableCounts: {
              todoByHumanCounts: { acme: 0, beta: 2 },
              awaitingOwnerCounts: { acme: 0, beta: 0 },
            },
          },
        },
        {
          name: 'the re-fetch gives the second candidate a positive awaiting-owner count',
          refetchedProjectsPayload: {
            pjcodes,
            actionableCounts: {
              todoByHumanCounts: { acme: 0, beta: 0 },
              awaitingOwnerCounts: { acme: 0, beta: 3 },
            },
          },
        },
      ];
      const projectsPayloadWithoutQualifyingCandidate: ProjectsPayload = {
        pjcodes,
        actionableCounts: {
          todoByHumanCounts: { acme: 0, beta: 0 },
          awaitingOwnerCounts: { acme: 0, beta: 0 },
        },
      };
      const { navigateReplaceState } = jest.requireMock<{
        navigateReplaceState: jest.Mock;
      }>('../lib/navigation');

      const observed: {
        name: string;
        pathsBeforeRefetch: string[];
        pathsAfterRefetch: string[];
      }[] = [];
      for (const scenario of scenarios) {
        localStorage.setItem(
          'tdpm-timer-settings',
          JSON.stringify({ timerMode: true, projectMinutes }),
        );
        window.history.replaceState({}, '', '/');
        let projectListFetchCount = 0;
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
            projectListFetchCount += 1;
            const servedPayload =
              projectListFetchCount === 1
                ? projectsPayloadWithoutQualifyingCandidate
                : scenario.refetchedProjectsPayload;
            return {
              ok: true,
              status: 200,
              json: async () => servedPayload,
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ body: '# body' }),
          };
        }) as unknown as typeof fetch;
        navigateReplaceState.mockClear();
        jest.useFakeTimers();
        try {
          const { unmount } = render(<ConsolePage />);
          await act(async () => {
            await jest.advanceTimersByTimeAsync(0);
          });
          expect(projectListFetchCount).toBe(1);
          const pathsBeforeRefetch = navigateReplaceState.mock.calls.map(
            (call: [string]) => call[0],
          );
          await act(async () => {
            await jest.advanceTimersByTimeAsync(
              CONSOLE_TAB_REFRESH_INTERVAL_MS,
            );
          });
          expect(projectListFetchCount).toBe(2);
          const pathsAfterRefetch = navigateReplaceState.mock.calls.map(
            (call: [string]) => call[0],
          );
          unmount();
          observed.push({
            name: scenario.name,
            pathsBeforeRefetch,
            pathsAfterRefetch: [...new Set(pathsAfterRefetch)],
          });
        } finally {
          jest.useRealTimers();
        }
      }

      expect(observed).toEqual(
        scenarios.map((scenario) => ({
          name: scenario.name,
          pathsBeforeRefetch: [],
          pathsAfterRefetch: ['/projects/beta/todo-by-human'],
        })),
      );
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

  it('reads console-story-show-archived from localStorage and shows gray stories when true', async () => {
    localStorage.setItem('console-story-show-archived', 'true');
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

    const { findByText, findByRole } = render(<ConsolePage />);
    expect(
      await findByText('regular / workflow improvement'),
    ).toBeInTheDocument();
    expect(await findByRole('switch', { name: 'Archived' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('writes true to console-story-show-archived in localStorage when the Archived switch is clicked', async () => {
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
    const archivedSwitch = await findByRole('switch', { name: 'Archived' });
    fireEvent.click(archivedSwitch);
    expect(localStorage.getItem('console-story-show-archived')).toBe('true');
  });

  it('reads console-story-show-done from localStorage and shows a story whose tasks are all Done when true', async () => {
    localStorage.setItem('console-story-show-done', 'true');
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
                  storyName: 'Completed Story',
                  storyOptionId: 'st3',
                  color: 'BLUE',
                  openItemCount: 1,
                  storyViewUrl: null,
                  items: [
                    {
                      number: 777,
                      title: 'Nested done task',
                      url: 'https://github.com/o/r/issues/777',
                      repo: 'o/r',
                      nameWithOwner: 'o/r',
                      projectItemId: 'PVTI_DONE',
                      itemId: 'PVTI_DONE',
                      isPr: false,
                      relatedOpenPullRequestUrls: [],
                      story: 'Completed Story',
                      status: 'Done',
                      agent: null,
                      nextActionDate: null,
                      nextActionHour: null,
                      dependedIssueUrls: [],
                      labels: [],
                      createdAt: '2026-06-18T00:00:00.000Z',
                    },
                  ],
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

    const { findByText, findByRole } = render(<ConsolePage />);
    expect(await findByText('Completed Story')).toBeInTheDocument();
    expect(await findByRole('switch', { name: 'Done' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('writes true to console-story-show-done in localStorage when the Done switch is clicked', async () => {
    window.history.replaceState({}, '', '/projects/acme/stories?k=token');
    installFetch();

    const { findByRole } = render(<ConsolePage />);
    const doneSwitch = await findByRole('switch', { name: 'Done' });
    fireEvent.click(doneSwitch);
    expect(localStorage.getItem('console-story-show-done')).toBe('true');
  });

  it('does not render the Archived or Done switches on a non-Stories tab', async () => {
    const { queryByRole, getByText } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    expect(queryByRole('switch', { name: 'Archived' })).toBeNull();
    expect(queryByRole('switch', { name: 'Done' })).toBeNull();
  });

  it('renders the Archived and Done switches on the Stories tab', async () => {
    window.history.replaceState({}, '', '/projects/acme/stories?k=token');
    installFetch();

    const { findByRole } = render(<ConsolePage />);
    expect(
      await findByRole('switch', { name: 'Archived' }),
    ).toBeInTheDocument();
    expect(await findByRole('switch', { name: 'Done' })).toBeInTheDocument();
  });

  it('renders the new story in the list immediately after handleStoryAdd succeeds without waiting for a poll cycle', async () => {
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
                  openItemCount: 1,
                  storyViewUrl: null,
                },
              ],
              defaultNameWithOwner: 'o/r',
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
      if (url === '/api/addstory') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            stories: [
              {
                id: 'st1',
                name: 'TDPM Console port',
                color: 'BLUE',
                description: '',
              },
              {
                id: 'st_new',
                name: 'My brand new story',
                color: 'RED',
                description: '',
              },
            ],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;

    const { getByRole, getByPlaceholderText, findByText } = render(
      <ConsolePage />,
    );

    await waitFor(() => {
      expect(getByRole('button', { name: 'Add story' })).toBeInTheDocument();
    });

    fireEvent.click(getByRole('button', { name: 'Add story' }));
    fireEvent.change(getByPlaceholderText('Story name'), {
      target: { value: 'My brand new story' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));

    expect(await findByText('My brand new story')).toBeInTheDocument();
  });

  it('preserves the existing stories list when the addstory response has no stories field', async () => {
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
                  openItemCount: 1,
                  storyViewUrl: null,
                },
              ],
              defaultNameWithOwner: 'o/r',
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
      if (url === '/api/addstory') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;

    const { getByRole, getByPlaceholderText, findByText } = render(
      <ConsolePage />,
    );

    await waitFor(() => {
      expect(getByRole('button', { name: 'Add story' })).toBeInTheDocument();
    });

    expect(await findByText('TDPM Console port')).toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: 'Add story' }));
    fireEvent.change(getByPlaceholderText('Story name'), {
      target: { value: 'Some new story' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));

    expect(await findByText('TDPM Console port')).toBeInTheDocument();
  });

  it('does not navigate to the next project automatically when prs count drops to zero on data refresh in timer mode', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({
        timerMode: true,
        projectMinutes: { acme: 30, beta: 30 },
      }),
    );
    let prsCallCount = 0;
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        if (tab === 'prs') {
          prsCallCount += 1;
          return {
            ok: true,
            status: 200,
            json: async () =>
              prsCallCount === 1
                ? listPayload('prs')
                : { ...listPayload('prs'), items: [] },
          };
        }
        return { ok: true, status: 200, json: async () => listPayload(tab) };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            pjcodes: ['acme', 'beta'],
            actionableCounts: actionableCountsWithBetaTodoByHumanItem,
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    const { navigatePush } = jest.requireMock<{
      navigatePush: jest.Mock;
    }>('../lib/navigation');
    navigatePush.mockClear();
    jest.useFakeTimers();
    try {
      const { getByText, queryByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      await act(async () => {
        jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
      });
      await waitFor(() => {
        expect(
          queryByText('Add serveConsole subcommand'),
        ).not.toBeInTheDocument();
      });
      expect(navigatePush).not.toHaveBeenCalledWith('/projects/beta');
    } finally {
      jest.useRealTimers();
    }
  });

  it('re-fetches the project list in the background after 60 seconds while timer mode is enabled', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({ timerMode: true, projectMinutes: { acme: 30 } }),
    );
    let projectsCallCount = 0;
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
        projectsCallCount += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      if (url.startsWith('/api/projectreadmeconfig')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ maximumPreparingIssuesCount: 3 }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    jest.useFakeTimers();
    try {
      const { getByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      await act(async () => {
        jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
      });
      await waitFor(() => {
        expect(projectsCallCount).toBeGreaterThanOrEqual(2);
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not navigate away from an open item detail screen when the background project-list re-fetch resolves with a changed project list', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({ timerMode: true, projectMinutes: { acme: 30 } }),
    );
    window.history.replaceState(
      {},
      '',
      '/projects/acme/failed-preparation?k=token',
    );
    const failedPreparationItem = {
      number: 900,
      title: 'Fix flaky CI step',
      url: 'https://github.com/o/r/issues/900',
      repo: 'o/r',
      nameWithOwner: 'o/r',
      projectItemId: 'PVTI_9',
      itemId: 'PVTI_9',
      isPr: false,
      relatedOpenPullRequestUrls: [],
      story: 'TDPM Console port',
      status: 'Failed Preparation',
      nextActionDate: null,
      nextActionHour: null,
      dependedIssueUrls: [],
      labels: [],
      createdAt: '2026-06-18T00:00:00.000Z',
    };
    const listCallCountByTab: Record<string, number> = {};
    let projectsCallCount = 0;
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        listCallCountByTab[tab] = (listCallCountByTab[tab] ?? 0) + 1;
        if (tab === 'failed-preparation') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ...listPayload(tab),
              items: [failedPreparationItem],
            }),
          };
        }
        if (
          (tab === 'prs' || tab === 'todo-by-human') &&
          listCallCountByTab[tab] >= 2
        ) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ...listPayload(tab), items: [] }),
          };
        }
        return { ok: true, status: 200, json: async () => listPayload(tab) };
      }
      if (url === '/api/projects') {
        projectsCallCount += 1;
        return {
          ok: true,
          status: 200,
          json: async () =>
            projectsCallCount === 1
              ? { pjcodes: ['acme'] }
              : {
                  pjcodes: ['acme', 'beta'],
                  actionableCounts: actionableCountsWithBetaTodoByHumanItem,
                },
        };
      }
      if (url.startsWith('/api/projectreadmeconfig')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ maximumPreparingIssuesCount: 3 }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    const { navigatePush } = jest.requireMock<{
      navigatePush: jest.Mock;
    }>('../lib/navigation');
    navigatePush.mockClear();

    jest.useFakeTimers();
    try {
      const { getByText, container } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Fix flaky CI step')).toBeInTheDocument();
      });
      fireEvent.click(getByText('Fix flaky CI step'));
      await waitFor(() => {
        expect(
          container.querySelector('.console-detail-title-text'),
        ).not.toBeNull();
      });
      expect(window.location.hash).toBe('#item/PVTI_9');
      expect(
        container.querySelector('.console-detail-title-text')?.textContent,
      ).toContain('Fix flaky CI step');
      expect(
        container.querySelector('.console-detail-number')?.textContent,
      ).toBe('#900');

      await act(async () => {
        jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
      });
      await waitFor(() => {
        expect(projectsCallCount).toBeGreaterThanOrEqual(2);
        expect(listCallCountByTab.prs).toBeGreaterThanOrEqual(2);
        expect(listCallCountByTab['todo-by-human']).toBeGreaterThanOrEqual(2);
      });

      expect(window.location.hash).toBe('#item/PVTI_9');
      expect(
        container.querySelector('.console-detail-title-text')?.textContent,
      ).toContain('Fix flaky CI step');
      expect(
        container.querySelector('.console-detail-number')?.textContent,
      ).toBe('#900');
      expect(navigatePush).not.toHaveBeenCalledWith(
        '/projects/beta/todo-by-human',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not re-fetch the project list in the background when timer mode is disabled', async () => {
    let projectsCallCount = 0;
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
        projectsCallCount += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      if (url.startsWith('/api/projectreadmeconfig')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ maximumPreparingIssuesCount: 3 }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    jest.useFakeTimers();
    try {
      const { getByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      await act(async () => {
        jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
      });
      expect(projectsCallCount).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('automatically navigates to the next project when the initial load shows no prs or todo items in timer mode', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({
        timerMode: true,
        projectMinutes: { acme: 30, beta: 30 },
      }),
    );
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        return {
          ok: true,
          status: 200,
          json: async () => ({ ...listPayload(tab), items: [] }),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            pjcodes: ['acme', 'beta'],
            actionableCounts: actionableCountsWithBetaTodoByHumanItem,
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    const { navigatePush } = jest.requireMock<{
      navigatePush: jest.Mock;
    }>('../lib/navigation');
    navigatePush.mockClear();
    render(<ConsolePage />);
    await waitFor(() => {
      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    });
  });

  it('switches within 120 seconds to the first candidate project with actionable items and never to a candidate without any, after the displayed project reaches zero actionable items in timer mode', async () => {
    const automaticSwitchDeadlineMs = 120000;
    const candidateWithoutActionableItems = 'beta';
    const candidateWithActionableItems = 'gamma';
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({
        timerMode: true,
        projectMinutes: {
          acme: 30,
          [candidateWithoutActionableItems]: 30,
          [candidateWithActionableItems]: 30,
        },
      }),
    );
    const displayedProjectFailedPreparationItem = {
      number: 900,
      title: 'Fix flaky CI step',
      url: 'https://github.com/o/r/issues/900',
      repo: 'o/r',
      nameWithOwner: 'o/r',
      projectItemId: 'PVTI_9',
      itemId: 'PVTI_9',
      isPr: false,
      relatedOpenPullRequestUrls: [],
      story: 'TDPM Console port',
      status: 'Failed Preparation',
      nextActionDate: null,
      nextActionHour: null,
      dependedIssueUrls: [],
      labels: [],
      createdAt: '2026-06-18T00:00:00.000Z',
    };
    let displayedProjectTodoByHumanAndAwaitingOwnerAreEmpty = false;
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        if (tab === 'failed-preparation') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ...listPayload(tab),
              items: [displayedProjectFailedPreparationItem],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () =>
            displayedProjectTodoByHumanAndAwaitingOwnerAreEmpty
              ? { ...listPayload(tab), items: [] }
              : listPayload(tab),
        };
      }
      if (url === '/api/projects') {
        const displayedProjectActionableCount =
          displayedProjectTodoByHumanAndAwaitingOwnerAreEmpty ? 0 : 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            pjcodes: [
              'acme',
              candidateWithoutActionableItems,
              candidateWithActionableItems,
            ],
            actionableCounts: {
              todoByHumanCounts: {
                acme: displayedProjectActionableCount,
                [candidateWithoutActionableItems]: 0,
                [candidateWithActionableItems]: 1,
              },
              awaitingOwnerCounts: {
                acme: displayedProjectActionableCount,
                [candidateWithoutActionableItems]: 0,
                [candidateWithActionableItems]: 0,
              },
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    const { navigatePush } = jest.requireMock<{
      navigatePush: jest.Mock;
    }>('../lib/navigation');
    navigatePush.mockClear();
    jest.useFakeTimers();
    try {
      const { getByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      expect(navigatePush).not.toHaveBeenCalled();

      displayedProjectTodoByHumanAndAwaitingOwnerAreEmpty = true;
      const refreshCount = Math.floor(
        automaticSwitchDeadlineMs / CONSOLE_TAB_REFRESH_INTERVAL_MS,
      );
      for (let refresh = 0; refresh < refreshCount; refresh += 1) {
        await act(async () => {
          jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
        });
      }

      expect(navigatePush).toHaveBeenCalledWith(
        `/projects/${candidateWithActionableItems}/todo-by-human`,
      );
      expect(navigatePush).not.toHaveBeenCalledWith(
        `/projects/${candidateWithoutActionableItems}/todo-by-human`,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('switches within 120 seconds to the first candidate project with actionable items after a live refresh removes the auto-opened item from every tab list in timer mode', async () => {
    const automaticSwitchDeadlineMs = 120000;
    const candidateWithoutActionableItems = 'beta';
    const candidateWithActionableItems = 'gamma';
    const autoOpenedItemTitle = 'Notify finished issue preparation';
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({
        timerMode: true,
        projectMinutes: {
          acme: 30,
          [candidateWithoutActionableItems]: 30,
          [candidateWithActionableItems]: 30,
        },
      }),
    );
    let displayedProjectTabListsAreEmpty = false;
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        const tabListServesAutoOpenedItem =
          tab === 'todo-by-human' && !displayedProjectTabListsAreEmpty;
        return {
          ok: true,
          status: 200,
          json: async () =>
            tabListServesAutoOpenedItem
              ? listPayload(tab)
              : { ...listPayload(tab), items: [] },
        };
      }
      if (url === '/api/projects') {
        const displayedProjectActionableCount = displayedProjectTabListsAreEmpty
          ? 0
          : 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            pjcodes: [
              'acme',
              candidateWithoutActionableItems,
              candidateWithActionableItems,
            ],
            actionableCounts: {
              todoByHumanCounts: {
                acme: displayedProjectActionableCount,
                [candidateWithoutActionableItems]: 0,
                [candidateWithActionableItems]: 1,
              },
              awaitingOwnerCounts: {
                acme: 0,
                [candidateWithoutActionableItems]: 0,
                [candidateWithActionableItems]: 0,
              },
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    const { navigatePush } = jest.requireMock<{
      navigatePush: jest.Mock;
    }>('../lib/navigation');
    navigatePush.mockClear();
    jest.useFakeTimers();
    try {
      const { getByText, queryByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText(autoOpenedItemTitle)).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(window.location.hash).toBe('#item/PVTI_2');
      });
      expect(navigatePush).not.toHaveBeenCalled();

      displayedProjectTabListsAreEmpty = true;
      const refreshCount = Math.floor(
        automaticSwitchDeadlineMs / CONSOLE_TAB_REFRESH_INTERVAL_MS,
      );
      for (let refresh = 0; refresh < refreshCount; refresh += 1) {
        await act(async () => {
          jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
        });
      }

      expect(queryByText(autoOpenedItemTitle)).not.toBeInTheDocument();
      expect(navigatePush).toHaveBeenCalledWith(
        `/projects/${candidateWithActionableItems}/todo-by-human`,
      );
      expect(navigatePush).toHaveBeenCalledTimes(1);
      expect(navigatePush).not.toHaveBeenCalledWith(
        `/projects/${candidateWithoutActionableItems}/todo-by-human`,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not switch projects within 120 seconds while the opened item is still shown in the displayed project, even when the displayed project has zero actionable items in timer mode', async () => {
    const automaticSwitchDeadlineMs = 120000;
    const candidateWithoutActionableItems = 'beta';
    const candidateWithActionableItems = 'gamma';
    const openedItemTitle = 'Fix flaky CI step';
    window.history.replaceState(
      {},
      '',
      '/projects/acme/failed-preparation?k=token#item/PVTI_9',
    );
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({
        timerMode: true,
        projectMinutes: {
          acme: 30,
          [candidateWithoutActionableItems]: 30,
          [candidateWithActionableItems]: 30,
        },
      }),
    );
    const displayedProjectFailedPreparationItem = {
      number: 900,
      title: openedItemTitle,
      url: 'https://github.com/o/r/issues/900',
      repo: 'o/r',
      nameWithOwner: 'o/r',
      projectItemId: 'PVTI_9',
      itemId: 'PVTI_9',
      isPr: false,
      relatedOpenPullRequestUrls: [],
      story: 'TDPM Console port',
      status: 'Failed Preparation',
      nextActionDate: null,
      nextActionHour: null,
      dependedIssueUrls: [],
      labels: [],
      createdAt: '2026-06-18T00:00:00.000Z',
    };
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...listPayload(tab),
            items:
              tab === 'failed-preparation'
                ? [displayedProjectFailedPreparationItem]
                : [],
          }),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            pjcodes: [
              'acme',
              candidateWithoutActionableItems,
              candidateWithActionableItems,
            ],
            actionableCounts: {
              todoByHumanCounts: {
                acme: 0,
                [candidateWithoutActionableItems]: 0,
                [candidateWithActionableItems]: 1,
              },
              awaitingOwnerCounts: {
                acme: 0,
                [candidateWithoutActionableItems]: 0,
                [candidateWithActionableItems]: 0,
              },
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    const { navigatePush } = jest.requireMock<{
      navigatePush: jest.Mock;
    }>('../lib/navigation');
    navigatePush.mockClear();
    jest.useFakeTimers();
    try {
      const { getAllByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getAllByText(openedItemTitle).length).toBeGreaterThan(0);
      });

      const refreshCount = Math.floor(
        automaticSwitchDeadlineMs / CONSOLE_TAB_REFRESH_INTERVAL_MS,
      );
      for (let refresh = 0; refresh < refreshCount; refresh += 1) {
        await act(async () => {
          jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
        });
      }

      expect(getAllByText(openedItemTitle).length).toBeGreaterThan(0);
      expect(window.location.hash).toBe('#item/PVTI_9');
      expect(navigatePush).not.toHaveBeenCalledWith(
        `/projects/${candidateWithoutActionableItems}/todo-by-human`,
      );
      expect(navigatePush).not.toHaveBeenCalledWith(
        `/projects/${candidateWithActionableItems}/todo-by-human`,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not switch projects within 120 seconds in timer mode when the active tab list of the displayed project is restored from the local cache without the opened item while the Awaiting Owner and Todo by human lists are live and empty', async () => {
    const automaticSwitchDeadlineMs = 120000;
    const openedItemTitle = 'Fix flaky CI step';
    const activeTabName = 'failed-preparation';
    window.history.replaceState(
      {},
      '',
      `/projects/acme/${activeTabName}?k=token#item/PVTI_9`,
    );
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({
        timerMode: true,
        projectMinutes: { acme: 30, beta: 30, gamma: 30 },
      }),
    );
    const displayedProjectFailedPreparationItem = {
      number: 900,
      title: openedItemTitle,
      url: 'https://github.com/o/r/issues/900',
      repo: 'o/r',
      nameWithOwner: 'o/r',
      projectItemId: 'PVTI_9',
      itemId: 'PVTI_9',
      isPr: false,
      relatedOpenPullRequestUrls: [],
      story: 'TDPM Console port',
      status: 'Failed Preparation',
      nextActionDate: null,
      nextActionHour: null,
      dependedIssueUrls: [],
      labels: [],
      createdAt: '2026-06-18T00:00:00.000Z',
    };
    let activeTabListIsServedOnlyFromCache = false;
    const cacheServingEmptyActiveTabList = {
      put: jest.fn(),
      match: jest.fn(async (url: string) => {
        if (
          !activeTabListIsServedOnlyFromCache ||
          !url.includes(`/${activeTabName}/`)
        ) {
          return undefined;
        }
        return new Response(
          JSON.stringify({ ...listPayload(activeTabName), items: [] }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }),
    };
    const originalCachesDescriptor = Object.getOwnPropertyDescriptor(
      global,
      'caches',
    );
    Object.defineProperty(global, 'caches', {
      writable: true,
      configurable: true,
      value: { open: jest.fn(async () => cacheServingEmptyActiveTabList) },
    });
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        if (tab === activeTabName && activeTabListIsServedOnlyFromCache) {
          throw new Error('Network unavailable');
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...listPayload(tab),
            items:
              tab === activeTabName
                ? [displayedProjectFailedPreparationItem]
                : [],
          }),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            pjcodes: ['acme', 'beta', 'gamma'],
            actionableCounts: {
              todoByHumanCounts: { acme: 0, beta: 0, gamma: 1 },
              awaitingOwnerCounts: { acme: 0, beta: 0, gamma: 0 },
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    const { navigatePush } = jest.requireMock<{
      navigatePush: jest.Mock;
    }>('../lib/navigation');
    navigatePush.mockClear();
    jest.useFakeTimers();
    try {
      const { getAllByText, queryByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getAllByText(openedItemTitle).length).toBeGreaterThan(0);
      });
      expect(window.location.hash).toBe('#item/PVTI_9');
      expect(navigatePush).not.toHaveBeenCalled();

      activeTabListIsServedOnlyFromCache = true;
      const refreshCount = Math.floor(
        automaticSwitchDeadlineMs / CONSOLE_TAB_REFRESH_INTERVAL_MS,
      );
      for (let refresh = 0; refresh < refreshCount; refresh += 1) {
        await act(async () => {
          jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
        });
      }

      expect(queryByText(openedItemTitle)).not.toBeInTheDocument();
      expect(navigatePush).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      if (originalCachesDescriptor === undefined) {
        delete (global as Record<string, unknown>).caches;
      } else {
        Object.defineProperty(global, 'caches', originalCachesDescriptor);
      }
    }
  });

  it('does not navigate to another project within 150 seconds in timer mode while the displayed project has no todo-by-human items but a positive awaiting-owner count and another project is eligible', async () => {
    const displayedProjectCode = 'acme';
    const eligibleCandidateProjectCode = 'beta';
    const observationDurationMs = 150000;
    const remainderAfterTwoRefreshesMs =
      observationDurationMs - 2 * CONSOLE_TAB_REFRESH_INTERVAL_MS;
    const todoByHumanPathPattern = /^\/projects\/([^/]+)\/todo-by-human/;
    const displayedProjectAwaitingOwnerCount = 3;
    const awaitingOwnerItemTemplate = listPayload('prs').items[0];
    const displayedProjectAwaitingOwnerItems = Array.from(
      { length: displayedProjectAwaitingOwnerCount },
      (_, index) => ({
        ...awaitingOwnerItemTemplate,
        number: 1001 + index,
        title: `Awaiting Owner item ${1001 + index}`,
        url: `https://github.com/o/r/issues/${1001 + index}`,
        isPr: false,
        projectItemId: `PVTI_AWAITING_OWNER_${index}`,
        itemId: `PVTI_AWAITING_OWNER_${index}`,
      }),
    );
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({
        timerMode: true,
        projectMinutes: {
          [displayedProjectCode]: 30,
          [eligibleCandidateProjectCode]: 30,
        },
      }),
    );
    let projectsFetchCount = 0;
    const listFetchCountByTab: Record<string, number> = {};
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        listFetchCountByTab[tab] = (listFetchCountByTab[tab] ?? 0) + 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...listPayload(tab),
            items: tab === 'prs' ? displayedProjectAwaitingOwnerItems : [],
          }),
        };
      }
      if (url === '/api/projects') {
        projectsFetchCount += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            pjcodes: [displayedProjectCode, eligibleCandidateProjectCode],
            actionableCounts: {
              todoByHumanCounts: {
                [displayedProjectCode]: 0,
                [eligibleCandidateProjectCode]: 1,
              },
              awaitingOwnerCounts: {
                [displayedProjectCode]: displayedProjectAwaitingOwnerCount,
                [eligibleCandidateProjectCode]: 0,
              },
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    const { navigatePush } = jest.requireMock<{
      navigatePush: jest.Mock;
    }>('../lib/navigation');
    navigatePush.mockClear();
    jest.useFakeTimers();
    try {
      render(<ConsolePage />);
      await waitFor(() => {
        expect(projectsFetchCount).toBeGreaterThanOrEqual(1);
        expect(listFetchCountByTab.prs).toBeGreaterThanOrEqual(1);
        expect(listFetchCountByTab['todo-by-human']).toBeGreaterThanOrEqual(1);
        expect(
          within(tabBar())
            .getByText('Awaiting Owner')
            .closest('a')
            ?.querySelector('.console-tab-badge')?.textContent,
        ).toBe(String(displayedProjectAwaitingOwnerCount));
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      const projectsFetchCountAfterEachStep = [projectsFetchCount];
      for (const stepDurationMs of [
        CONSOLE_TAB_REFRESH_INTERVAL_MS,
        CONSOLE_TAB_REFRESH_INTERVAL_MS,
        remainderAfterTwoRefreshesMs,
      ]) {
        await act(async () => {
          await jest.advanceTimersByTimeAsync(stepDurationMs);
        });
        projectsFetchCountAfterEachStep.push(projectsFetchCount);
      }

      expect(projectsFetchCountAfterEachStep[1]).toBeGreaterThan(
        projectsFetchCountAfterEachStep[0],
      );
      expect(projectsFetchCountAfterEachStep[2]).toBeGreaterThan(
        projectsFetchCountAfterEachStep[1],
      );
      expect(
        within(tabBar()).getByRole('button', { name: displayedProjectCode }),
      ).toBeInTheDocument();
      const navigatedToOtherProjectTodoByHumanPaths = navigatePush.mock.calls
        .map((call: [string]) => call[0])
        .filter((path) => {
          const match = path.match(todoByHumanPathPattern);
          return match !== null && match[1] !== displayedProjectCode;
        });
      expect(navigatedToOtherProjectTodoByHumanPaths).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('navigates to the next project immediately when a completing action is queued after the project timer elapses, before the undo grace period ends or the write is sent', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({ timerMode: true, projectMinutes: { acme: 1, beta: 5 } }),
    );
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
        if (url === '/api/projects') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              pjcodes: ['acme', 'beta'],
              actionableCounts: actionableCountsWithBetaTodoByHumanItem,
            }),
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
    jest.useFakeTimers({ now: 0 });
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      jest.setSystemTime(61 * 1000);
      const { navigatePush } = jest.requireMock<{
        navigatePush: jest.Mock;
      }>('../lib/navigation');
      navigatePush.mockClear();
      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve & Merge')).toBeInTheDocument();

      fireEvent.click(getByText('Approve & Merge'));

      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
      expect(navigatePush).toHaveBeenCalledTimes(1);
      const postCallsBeforeGraceElapses = fetchMock.mock.calls.filter(
        (call) => call[1]?.method === 'POST',
      );
      expect(postCallsBeforeGraceElapses.length).toBe(0);

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(navigatePush).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('navigates to the next project immediately when a completing action is queued after DEFAULT_TIMER_MINUTES elapses for an unconfigured project, before the undo grace period ends', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({ timerMode: true, projectMinutes: { beta: 5 } }),
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
          json: async () => ({
            pjcodes: ['acme', 'beta'],
            actionableCounts: actionableCountsWithBetaTodoByHumanItem,
          }),
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
      jest.setSystemTime(16 * 60 * 1000);
      const { navigatePush } = jest.requireMock<{
        navigatePush: jest.Mock;
      }>('../lib/navigation');
      navigatePush.mockClear();
      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve & Merge')).toBeInTheDocument();

      fireEvent.click(getByText('Approve & Merge'));

      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');

      act(() => {
        jest.advanceTimersByTime(5100);
      });
      expect(navigatePush).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('navigates immediately when the timer has elapsed and shows the error toast on the already-switched-to screen without navigating back when the write later fails', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({ timerMode: true, projectMinutes: { acme: 1, beta: 5 } }),
    );
    global.fetch = jest.fn(async (url: string, init?: { method?: string }) => {
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
          json: async () => ({
            pjcodes: ['acme', 'beta'],
            actionableCounts: actionableCountsWithBetaTodoByHumanItem,
          }),
        };
      }
      if (init?.method === 'POST') {
        return {
          ok: false,
          status: 500,
          text: async () => JSON.stringify({ error: 'merge failed' }),
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
      const { navigatePush } = jest.requireMock<{
        navigatePush: jest.Mock;
      }>('../lib/navigation');
      navigatePush.mockClear();

      fireEvent.click(getByText('Add serveConsole subcommand'));
      fireEvent.click(await findByText('Approve & Merge'));

      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
      expect(navigatePush).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(getByText(/^Operation failed:/)).toBeInTheDocument();
      expect(navigatePush).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not navigate again when a retried write succeeds after the timer-elapsed project switch already navigated once', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({ timerMode: true, projectMinutes: { acme: 1, beta: 5 } }),
    );
    let postCallCount = 0;
    global.fetch = jest.fn(async (url: string, init?: { method?: string }) => {
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
          json: async () => ({
            pjcodes: ['acme', 'beta'],
            actionableCounts: actionableCountsWithBetaTodoByHumanItem,
          }),
        };
      }
      if (init?.method === 'POST') {
        postCallCount += 1;
        if (postCallCount === 1) {
          return {
            ok: false,
            status: 500,
            text: async () => JSON.stringify({ error: 'merge failed' }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
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
      const { navigatePush } = jest.requireMock<{
        navigatePush: jest.Mock;
      }>('../lib/navigation');
      navigatePush.mockClear();

      fireEvent.click(getByText('Add serveConsole subcommand'));
      fireEvent.click(await findByText('Approve & Merge'));

      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
      expect(navigatePush).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(getByText(/^Operation failed:/)).toBeInTheDocument();
      expect(postCallCount).toBe(1);
      expect(navigatePush).toHaveBeenCalledTimes(1);

      await act(async () => {
        fireEvent.click(getByText('Retry'));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(postCallCount).toBe(2);
      expect(navigatePush).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not send the write, but does not undo the already-occurred project switch, when the action is undone within the grace period even though the timer had already elapsed', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({ timerMode: true, projectMinutes: { acme: 1, beta: 5 } }),
    );
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
        if (url === '/api/projects') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              pjcodes: ['acme', 'beta'],
              actionableCounts: actionableCountsWithBetaTodoByHumanItem,
            }),
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
    jest.useFakeTimers({ now: 0 });
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      jest.setSystemTime(61 * 1000);
      const { navigatePush } = jest.requireMock<{
        navigatePush: jest.Mock;
      }>('../lib/navigation');
      navigatePush.mockClear();

      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve & Merge')).toBeInTheDocument();
      fireEvent.click(getByText('Approve & Merge'));

      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');

      fireEvent.click(getByText('Undo'));

      act(() => {
        jest.advanceTimersByTime(6000);
      });

      const postCalls = fetchMock.mock.calls.filter(
        (call) => call[1]?.method === 'POST',
      );
      expect(postCalls.length).toBe(0);
      expect(navigatePush).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not send the write, but does not undo the already-occurred project switch, when the action is undone within the grace period even though completing it would have brought the remaining count to zero', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({
        timerMode: true,
        projectMinutes: { acme: 30, beta: 30 },
      }),
    );
    const fetchMock = jest.fn(
      async (url: string, init?: { method?: string }) => {
        const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
        if (listMatch !== null) {
          const tab = listMatch[1];
          return {
            ok: true,
            status: 200,
            json: async () =>
              tab === 'todo-by-human'
                ? { ...listPayload(tab), items: [] }
                : listPayload(tab),
          };
        }
        if (url === '/api/projects') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              pjcodes: ['acme', 'beta'],
              actionableCounts: actionableCountsWithBetaTodoByHumanItem,
            }),
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
    const mountTime = Date.parse('2026-06-19T00:01:00.000Z');
    jest.useFakeTimers({ now: mountTime });
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      const { navigatePush } = jest.requireMock<{
        navigatePush: jest.Mock;
      }>('../lib/navigation');
      navigatePush.mockClear();

      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve & Merge')).toBeInTheDocument();
      fireEvent.click(getByText('Approve & Merge'));

      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');

      fireEvent.click(getByText('Undo'));

      act(() => {
        jest.advanceTimersByTime(6000);
      });

      const postCalls = fetchMock.mock.calls.filter(
        (call) => call[1]?.method === 'POST',
      );
      expect(postCalls.length).toBe(0);
      expect(navigatePush).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('navigates exactly once, immediately, when the timer-elapsed condition and the remaining-count-zero condition both hold for the same newly enqueued action', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({ timerMode: true, projectMinutes: { acme: 1, beta: 5 } }),
    );
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        return {
          ok: true,
          status: 200,
          json: async () =>
            tab === 'todo-by-human'
              ? { ...listPayload(tab), items: [] }
              : listPayload(tab),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            pjcodes: ['acme', 'beta'],
            actionableCounts: actionableCountsWithBetaTodoByHumanItem,
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    const mountTime = Date.parse('2026-06-19T00:01:00.000Z');
    jest.useFakeTimers({ now: mountTime });
    try {
      const { getByText, findByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      jest.setSystemTime(mountTime + 61 * 1000);
      const { navigatePush } = jest.requireMock<{
        navigatePush: jest.Mock;
      }>('../lib/navigation');
      navigatePush.mockClear();

      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve & Merge')).toBeInTheDocument();

      fireEvent.click(getByText('Approve & Merge'));

      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
      expect(navigatePush).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(navigatePush).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the offline pending panel with a repository-qualified item label after the project switch when the write fails because the network is unavailable', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({ timerMode: true, projectMinutes: { acme: 1, beta: 5 } }),
    );
    global.fetch = jest.fn(async (url: string, init?: { method?: string }) => {
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
          json: async () => ({
            pjcodes: ['acme', 'beta'],
            actionableCounts: actionableCountsWithBetaTodoByHumanItem,
          }),
        };
      }
      if (init?.method === 'POST') {
        throw new TypeError('Failed to fetch');
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    jest.useFakeTimers({ now: 0 });
    try {
      const { getByText, findByText, container } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      jest.setSystemTime(61 * 1000);
      const { navigatePush } = jest.requireMock<{
        navigatePush: jest.Mock;
      }>('../lib/navigation');
      navigatePush.mockClear();

      fireEvent.click(getByText('Add serveConsole subcommand'));
      fireEvent.click(await findByText('Approve & Merge'));

      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(
          container.querySelector('.console-offline-panel-header')?.textContent,
        ).toMatch(/^1 action held/);
      });
      expect(
        container.querySelector('.console-offline-panel-item-target')
          ?.textContent,
      ).toContain('o/r#851');
      expect(navigatePush).toHaveBeenCalledTimes(1);
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
    status: 'Awaiting Owner',
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

  const readStoredOfflineQueue = (): Record<string, unknown>[] =>
    JSON.parse(localStorage.getItem('console-offline-action-queue') ?? '[]');

  const postRequestCount = (): number =>
    (global.fetch as jest.Mock).mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    ).length;

  const openPullRequestDetailInAirplaneMode = async (
    view: ReturnType<typeof render>,
  ): Promise<void> => {
    await waitFor(() => {
      expect(view.getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(view.getByText('Turn off')).toBeInTheDocument();
    });
    fireEvent.click(view.getByText('Add serveConsole subcommand'));
    expect(await view.findByText('Approve & Merge')).toBeInTheDocument();
  };

  const dismissUndoToast = async (container: HTMLElement): Promise<void> => {
    const dismissButton = await waitFor(() => {
      const button = container.querySelector('.console-undo-toast-dismiss');
      expect(button).not.toBeNull();
      return button as HTMLElement;
    });
    fireEvent.click(dismissButton);
  };

  it('holds a queue action in the offline queue with its optimistic overlay, shows no airplane mode error, and sends nothing when airplane mode is on', async () => {
    const view = render(<ConsolePage />);
    await openPullRequestDetailInAirplaneMode(view);

    fireEvent.click(view.getByText('Approve & Merge'));
    await dismissUndoToast(view.container);

    await waitFor(() => {
      expect(readStoredOfflineQueue()).toEqual([
        expect.objectContaining({
          itemUrl: prItem.url,
          projectItemId: prItem.projectItemId,
          apiPath: '/api/review',
        }),
      ]);
    });
    expect(view.queryByText('Airplane mode')).toBeNull();
    expect(view.container.querySelector('.console-error-toast')).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(overlayStorageKey('acme')) ?? '{}')[
        prItem.projectItemId
      ],
    ).toMatchObject({ done: true });
    expect(postRequestCount()).toBe(0);
  });

  it('holds a composer comment with the item URL and body across a reload and sends no /api/comment request when airplane mode is on', async () => {
    const view = render(<ConsolePage />);
    await openPullRequestDetailInAirplaneMode(view);

    fireEvent.change(view.getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Written above the clouds.' },
    });
    fireEvent.click(view.getByText('Comment'));

    await waitFor(() => {
      expect(readStoredOfflineQueue()).toEqual([
        expect.objectContaining({
          itemUrl: prItem.url,
          apiPath: '/api/comment',
          requestBody: {
            pjcode: 'acme',
            url: prItem.url,
            body: 'Written above the clouds.',
          },
        }),
      ]);
    });
    expect(view.queryByText('Airplane mode')).toBeNull();
    view.unmount();

    const reloadedView = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        reloadedView.container.querySelector('.console-offline-panel-header')
          ?.textContent,
      ).toMatch(/^1 action held/);
    });
    expect(readStoredOfflineQueue()).toEqual([
      expect.objectContaining({
        apiPath: '/api/comment',
        requestBody: {
          pjcode: 'acme',
          url: prItem.url,
          body: 'Written above the clouds.',
        },
      }),
    ]);
    expect(postRequestCount()).toBe(0);
  });

  it('holds both the ok comment and the close of OK & Close in order and sends nothing when airplane mode is on', async () => {
    const view = render(<ConsolePage />);
    await openPullRequestDetailInAirplaneMode(view);

    fireEvent.click(view.getByText('OK & Close'));
    await dismissUndoToast(view.container);

    await waitFor(() => {
      expect(readStoredOfflineQueue()).toHaveLength(2);
    });
    expect(readStoredOfflineQueue()).toEqual([
      expect.objectContaining({
        itemUrl: prItem.url,
        apiPath: '/api/comment',
        requestBody: { pjcode: 'acme', url: prItem.url, body: 'ok' },
      }),
      expect.objectContaining({
        itemUrl: prItem.url,
        apiPath: '/api/triage',
        requestBody: {
          pjcode: 'acme',
          action: 'close',
          issueUrl: prItem.url,
          projectItemId: prItem.projectItemId,
          expectedStatusName: prItem.status,
        },
      }),
    ]);
    expect(view.queryByText('Airplane mode')).toBeNull();
    expect(postRequestCount()).toBe(0);
  });

  it('holds both the comment and the close of Comment & Close in order and sends nothing when airplane mode is on', async () => {
    const view = render(<ConsolePage />);
    await openPullRequestDetailInAirplaneMode(view);

    fireEvent.change(view.getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Closing above the clouds.' },
    });
    fireEvent.click(view.getByText('Comment & Close'));
    await dismissUndoToast(view.container);

    await waitFor(() => {
      expect(readStoredOfflineQueue()).toHaveLength(2);
    });
    expect(readStoredOfflineQueue()).toEqual([
      expect.objectContaining({
        itemUrl: prItem.url,
        apiPath: '/api/comment',
        requestBody: {
          pjcode: 'acme',
          url: prItem.url,
          body: 'Closing above the clouds.',
        },
      }),
      expect.objectContaining({
        itemUrl: prItem.url,
        apiPath: '/api/triage',
        requestBody: {
          pjcode: 'acme',
          action: 'close',
          issueUrl: prItem.url,
          projectItemId: prItem.projectItemId,
          expectedStatusName: prItem.status,
        },
      }),
    ]);
    expect(view.queryByText('Airplane mode')).toBeNull();
    expect(postRequestCount()).toBe(0);
  });

  it('holds both the ok comment and the move to Awaiting Workspace of ok & Awaiting Workspace from the list in order and sends nothing when airplane mode is on', async () => {
    const view = render(<ConsolePage />);
    await waitFor(() => {
      expect(view.getByText('Turn off')).toBeInTheDocument();
    });
    const [okAndAwaitingWorkspaceButton] = await view.findAllByRole('button', {
      name: 'ok & Awaiting Workspace',
    });

    fireEvent.click(okAndAwaitingWorkspaceButton);
    await dismissUndoToast(view.container);

    await waitFor(() => {
      expect(readStoredOfflineQueue()).toHaveLength(2);
    });
    expect(readStoredOfflineQueue()).toEqual([
      expect.objectContaining({
        itemUrl: prItem.url,
        apiPath: '/api/comment',
        requestBody: { pjcode: 'acme', url: prItem.url, body: 'ok' },
      }),
      expect.objectContaining({
        itemUrl: prItem.url,
        apiPath: '/api/triage',
        requestBody: {
          pjcode: 'acme',
          action: 'set_status',
          issueUrl: prItem.url,
          projectItemId: prItem.projectItemId,
          statusName: 'Awaiting Workspace',
          expectedStatusName: 'Awaiting Owner',
        },
      }),
    ]);
    expect(view.queryByText('Airplane mode')).toBeNull();
    expect(postRequestCount()).toBe(0);
  });
});

describe('ConsolePage airplane mode control visibility on offline cold start', () => {
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
    status: 'Awaiting Owner',
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

  const mockFeaturesUnreachableFetch = (): void => {
    global.fetch = jest.fn(async (url: string) => {
      if (url === '/api/features') {
        return { ok: false, status: 503, json: async () => ({}) };
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
  };

  afterEach(() => {
    Object.defineProperty(global, 'caches', {
      writable: true,
      configurable: true,
      value: undefined,
    });
  });

  it('shows the Airplane Mode control in its "on" state when /api/features fails but a snapshot already exists for the opened project', async () => {
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
    mockFeaturesUnreachableFetch();

    const view = render(<ConsolePage />);

    expect(await view.findByText('Turn off')).toBeInTheDocument();
  });

  it('keeps the Airplane Mode control hidden when no snapshot flag is set and /api/features fails (regression)', async () => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');

    const mockCache = {
      put: jest.fn(),
      match: jest.fn().mockResolvedValue(undefined),
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
    mockFeaturesUnreachableFetch();

    const view = render(<ConsolePage />);

    await waitFor(() => {
      expect(
        (global.fetch as jest.Mock).mock.calls.some(
          ([url]) => url === '/api/features',
        ),
      ).toBe(true);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(view.queryByText('✈ Airplane mode')).toBeNull();
    expect(view.queryByText('Turn off')).toBeNull();
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

  it('advances to the next pending item instead of returning to the list after Delete Story', async () => {
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
                    {
                      number: 1000,
                      title: 'Next task after story deletion',
                      url: 'https://github.com/o/r/issues/1000',
                      repo: 'o/r',
                      nameWithOwner: 'o/r',
                      projectItemId: 'PVTI_NT2',
                      itemId: 'PVTI_NT2',
                      isPr: false,
                      relatedOpenPullRequestUrls: [],
                      story: 'TDPM Console port',
                      status: 'Todo by human',
                      nextActionDate: null,
                      nextActionHour: null,
                      dependedIssueUrls: [],
                      labels: [],
                      createdAt: '2026-06-18T00:00:01.000Z',
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
      if (url === '/api/deletestory') {
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

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
    fireEvent.click(getByText('Delete Story'));
    await waitFor(() => {
      expect(getByText('Keep child tasks')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Keep child tasks'));

    await waitFor(() => {
      expect(window.location.hash).toBe('#item/PVTI_NT2');
    });
  });
});

describe('ConsolePage task creation action queue', () => {
  const storiesTabPayload = () => ({
    ...listPayload('stories'),
    defaultNameWithOwner: 'o/r',
  });

  const installFetchWithBlockingCreate = (): jest.Mock => {
    const fetchMock = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        return {
          ok: true,
          status: 200,
          json: async () =>
            tab === 'stories' ? storiesTabPayload() : listPayload(tab),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      if (url === '/api/createissue') {
        return new Promise<never>(() => {});
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  const installFetchWithFailingCreate = (): jest.Mock => {
    const fetchMock = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        return {
          ok: true,
          status: 200,
          json: async () =>
            tab === 'stories' ? storiesTabPayload() : listPayload(tab),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      if (url === '/api/createissue') {
        return {
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
  });

  it('closes the create-task dialog immediately when Create is pressed, before postConsoleCreateIssue resolves', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithBlockingCreate();
      const { queryByRole, getByRole, getByLabelText } = render(
        <ConsolePage />,
      );

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });

      fireEvent.click(getByRole('button', { name: 'Create new task' }));

      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });

      fireEvent.change(getByLabelText('Title'), {
        target: { value: 'My new task' },
      });

      fireEvent.click(getByRole('button', { name: 'Create' }));

      await waitFor(() => {
        expect(queryByRole('dialog', { name: 'Create new task' })).toBeNull();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows a task-created undo toast immediately after Create is pressed', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithBlockingCreate();
      const { queryByText, getByRole, getByLabelText } = render(
        <ConsolePage />,
      );

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });

      fireEvent.click(getByRole('button', { name: 'Create new task' }));

      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });

      fireEvent.change(getByLabelText('Title'), {
        target: { value: 'My new task' },
      });

      fireEvent.click(getByRole('button', { name: 'Create' }));

      await waitFor(() => {
        expect(
          queryByText(/Creating task — "My new task"/),
        ).toBeInTheDocument();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not call postConsoleCreateIssue when Undo is clicked within 5 seconds', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = installFetchWithBlockingCreate();
      const { getByRole, getByLabelText } = render(<ConsolePage />);

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });

      fireEvent.click(getByRole('button', { name: 'Create new task' }));

      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });

      fireEvent.change(getByLabelText('Title'), {
        target: { value: 'My new task' },
      });

      fireEvent.click(getByRole('button', { name: 'Create' }));

      await waitFor(() => {
        expect(getByRole('button', { name: 'Undo' })).toBeInTheDocument();
      });

      fireEvent.click(getByRole('button', { name: 'Undo' }));

      act(() => {
        jest.advanceTimersByTime(6000);
      });

      const createIssueCalls = fetchMock.mock.calls.filter(
        ([url]: [string]) => url === '/api/createissue',
      );
      expect(createIssueCalls.length).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('calls postConsoleCreateIssue once after 5 seconds elapse without Undo', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = jest.fn(async (url: string) => {
        const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
        if (listMatch !== null) {
          const tab = listMatch[1];
          return {
            ok: true,
            status: 200,
            json: async () =>
              tab === 'stories' ? storiesTabPayload() : listPayload(tab),
          };
        }
        if (url === '/api/projects') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ pjcodes: ['acme'] }),
          };
        }
        if (url === '/api/createissue') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              issueUrl: 'https://github.com/o/r/issues/100',
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ body: '# body' }),
        };
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { getByRole, getByLabelText } = render(<ConsolePage />);

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });

      fireEvent.click(getByRole('button', { name: 'Create new task' }));

      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });

      fireEvent.change(getByLabelText('Title'), {
        target: { value: 'My new task' },
      });

      fireEvent.click(getByRole('button', { name: 'Create' }));

      act(() => {
        jest.advanceTimersByTime(4900);
      });

      const createCallsBefore = fetchMock.mock.calls.filter(
        ([url]: [string]) => url === '/api/createissue',
      );
      expect(createCallsBefore.length).toBe(0);

      await act(async () => {
        jest.advanceTimersByTime(200);
        await Promise.resolve();
        await Promise.resolve();
      });

      const createCallsAfter = fetchMock.mock.calls.filter(
        ([url]: [string]) => url === '/api/createissue',
      );
      expect(createCallsAfter.length).toBe(1);
      const createBody = JSON.parse(
        (createCallsAfter[0] as unknown as [string, RequestInit])[1]
          .body as string,
      ) as { storyName: string; body: string | null };
      expect(createBody.storyName).toBe('TDPM Console port');
      expect(createBody.body).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('passes body from dialog to postConsoleCreateIssue when body is filled in', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = jest.fn(async (url: string) => {
        const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
        if (listMatch !== null) {
          const tab = listMatch[1];
          return {
            ok: true,
            status: 200,
            json: async () =>
              tab === 'stories' ? storiesTabPayload() : listPayload(tab),
          };
        }
        if (url === '/api/projects') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ pjcodes: ['acme'] }),
          };
        }
        if (url === '/api/createissue') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              issueUrl: 'https://github.com/o/r/issues/100',
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ body: '# body' }),
        };
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { getByRole, getByLabelText } = render(<ConsolePage />);

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });

      fireEvent.click(getByRole('button', { name: 'Create new task' }));

      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });

      fireEvent.change(getByLabelText('Title'), {
        target: { value: 'Task with body text' },
      });
      fireEvent.change(getByLabelText('Body'), {
        target: { value: 'This is the task body' },
      });

      fireEvent.click(getByRole('button', { name: 'Create' }));

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      const createCallsAfter = fetchMock.mock.calls.filter(
        ([url]: [string]) => url === '/api/createissue',
      );
      expect(createCallsAfter.length).toBe(1);
      const createBody = JSON.parse(
        (createCallsAfter[0] as unknown as [string, RequestInit])[1]
          .body as string,
      ) as { storyName: string; body: string | null };
      expect(createBody.storyName).toBe('TDPM Console port');
      expect(createBody.body).toBe('This is the task body');
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders an SVG icon inside the Create new task button', async () => {
    installFetchWithBlockingCreate();
    const { getByRole } = render(<ConsolePage />);

    await waitFor(() => {
      expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
    });

    const button = getByRole('button', { name: 'Create new task' });
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('opens IssueCreateModalDialog with title and story pre-filled when Edit is clicked after story task creation failure', async () => {
    window.history.replaceState({}, '', '/projects/acme/stories?k=token');
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        return {
          ok: true,
          status: 200,
          json: async () =>
            tab === 'stories' ? storiesTabPayload() : listPayload(tab),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      if (url === '/api/createissue') {
        return {
          ok: false,
          status: 500,
          text: async () => '',
          json: async () => ({}),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;

    const { getByRole, getByPlaceholderText } = render(<ConsolePage />);

    await waitFor(() => {
      expect(getByRole('button', { name: '+ Add task' })).toBeInTheDocument();
    });

    fireEvent.click(getByRole('button', { name: '+ Add task' }));

    await waitFor(() => {
      expect(
        getByRole('dialog', { name: 'Add task to TDPM Console port' }),
      ).toBeInTheDocument();
    });

    fireEvent.change(getByPlaceholderText('Issue title'), {
      target: { value: 'My draft task' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    fireEvent.click(getByRole('button', { name: 'Edit' }));

    await waitFor(() => {
      expect(
        getByRole('dialog', { name: 'Create new task' }),
      ).toBeInTheDocument();
    });

    const fullDialog = getByRole('dialog', { name: 'Create new task' });
    expect(within(fullDialog).getByLabelText('Title')).toHaveValue(
      'My draft task',
    );
    expect(
      within(fullDialog).getByRole('button', {
        name: /TDPM Console port/,
        pressed: true,
      }),
    ).toBeInTheDocument();
  });

  it('reopens the header create-task dialog with retained values and the failure reason when the project-destination create request fails after the undo window elapses', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFailingCreate();
      const { getByRole } = render(<ConsolePage />);

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });

      fireEvent.click(getByRole('button', { name: 'Create new task' }));

      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });

      const openDialog = getByRole('dialog', { name: 'Create new task' });
      fireEvent.change(within(openDialog).getByLabelText('Title'), {
        target: { value: 'Failing project task' },
      });
      fireEvent.change(within(openDialog).getByLabelText('Body'), {
        target: { value: 'Failing project body' },
      });
      fireEvent.click(
        within(openDialog).getByRole('button', {
          name: /TDPM Console port/,
        }),
      );
      fireEvent.click(
        within(openDialog).getByRole('button', { name: /^developer$/i }),
      );

      fireEvent.click(
        within(openDialog).getByRole('button', { name: 'Create' }),
      );

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });
      const reopenedDialog = getByRole('dialog', { name: 'Create new task' });
      expect(within(reopenedDialog).getByLabelText('Title')).toHaveValue(
        'Failing project task',
      );
      expect(within(reopenedDialog).getByLabelText('Body')).toHaveValue(
        'Failing project body',
      );
      expect(
        within(reopenedDialog)
          .getByRole('button', { name: /TDPM Console port/ })
          .getAttribute('aria-pressed'),
      ).toBe('true');
      expect(
        within(reopenedDialog)
          .getByRole('button', { name: /^developer$/i })
          .getAttribute('aria-pressed'),
      ).toBe('true');
      expect(
        within(reopenedDialog)
          .getByRole('button', { name: 'Project' })
          .getAttribute('aria-pressed'),
      ).toBe('true');
      expect(within(reopenedDialog).getByRole('alert').textContent).toBe(
        'Failed to create the task. Please try again.',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not claim a task was created in the error banner when postConsoleCreateIssue itself fails', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFailingCreate();
      const { getByRole, container } = render(<ConsolePage />);

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });

      fireEvent.click(getByRole('button', { name: 'Create new task' }));

      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });

      const openDialog = getByRole('dialog', { name: 'Create new task' });
      fireEvent.change(within(openDialog).getByLabelText('Title'), {
        target: { value: 'Pure creation failure task' },
      });
      fireEvent.click(
        within(openDialog).getByRole('button', { name: 'Create' }),
      );

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(
          container.querySelector('.console-error-toast-message'),
        ).not.toBeNull();
      });
      const toastTitle = container.querySelector('.console-error-toast-title');
      const toastMessage = container.querySelector(
        '.console-error-toast-message',
      );
      expect(toastTitle?.textContent ?? '').not.toContain('Task created');
      expect(toastMessage?.textContent ?? '').not.toContain('Task created');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not create a duplicate GitHub issue when the dialog Create button is clicked again after a partial attachment upload failure', async () => {
    jest.useFakeTimers();
    try {
      let uploadAttemptCount = 0;
      const fetchMock = jest.fn(async (url: string) => {
        const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
        if (listMatch !== null) {
          const tab = listMatch[1];
          return {
            ok: true,
            status: 200,
            json: async () =>
              tab === 'stories' ? storiesTabPayload() : listPayload(tab),
          };
        }
        if (url === '/api/projects') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ pjcodes: ['acme'] }),
          };
        }
        if (url === '/api/createissue') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              issueUrl: 'https://github.com/o/r/issues/777',
            }),
          };
        }
        if (url === '/api/upload') {
          uploadAttemptCount += 1;
          if (uploadAttemptCount === 1) {
            return {
              ok: false,
              status: 500,
              text: async () => 'upload failed',
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              markdown: '![attachment.png](https://example.com/attachment.png)',
            }),
          };
        }
        if (url === '/api/comment') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              comment: {
                id: 1,
                author: 'bot',
                body: '![attachment.png](https://example.com/attachment.png)',
                createdAt: '2026-06-19T00:00:00.000Z',
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ body: '# body' }),
        };
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { getByRole } = render(<ConsolePage />);

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });

      fireEvent.click(getByRole('button', { name: 'Create new task' }));

      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });

      const openDialog = getByRole('dialog', { name: 'Create new task' });
      fireEvent.change(within(openDialog).getByLabelText('Title'), {
        target: { value: 'Task with a failing attachment' },
      });
      fireEvent.change(within(openDialog).getByLabelText('Body'), {
        target: { value: 'Body text for the retried task' },
      });
      fireEvent.click(
        within(openDialog).getByRole('button', { name: /TDPM Console port/ }),
      );
      fireEvent.click(
        within(openDialog).getByRole('button', { name: /^developer$/i }),
      );

      const testFile = new File(['x'], 'attachment.png', {
        type: 'image/png',
      });
      (
        testFile as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }
      ).arrayBuffer = async () => new Uint8Array([120]).buffer;
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [testFile],
        configurable: true,
      });
      await act(async () => {
        fireEvent.change(fileInput);
      });
      await waitFor(() => {
        expect(
          document.querySelector('.console-task-create-dialog-file-name'),
        ).toBeInTheDocument();
      });

      fireEvent.click(
        within(openDialog).getByRole('button', { name: 'Create' }),
      );

      await act(async () => {
        jest.advanceTimersByTime(5100);
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
        }
      });

      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });
      const reopenedDialog = getByRole('dialog', { name: 'Create new task' });
      expect(within(reopenedDialog).getByLabelText('Title')).toHaveValue(
        'Task with a failing attachment',
      );
      expect(within(reopenedDialog).getByLabelText('Body')).toHaveValue(
        'Body text for the retried task',
      );
      expect(
        within(reopenedDialog)
          .getByRole('button', { name: /TDPM Console port/ })
          .getAttribute('aria-pressed'),
      ).toBe('true');
      expect(
        within(reopenedDialog)
          .getByRole('button', { name: /^developer$/i })
          .getAttribute('aria-pressed'),
      ).toBe('true');
      expect(within(reopenedDialog).getByRole('alert').textContent).toContain(
        'attachment.png',
      );

      fireEvent.click(
        within(reopenedDialog).getByRole('button', { name: 'Create' }),
      );

      await act(async () => {
        jest.advanceTimersByTime(5100);
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
        }
      });

      const createIssueCalls = fetchMock.mock.calls.filter(
        ([callUrl]: [string]) => callUrl === '/api/createissue',
      );
      expect(createIssueCalls.length).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not cross-contaminate attachments between two tasks when the second is created while the first commit is still in-flight', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = jest.fn(
        async (url: string, options?: { body?: string }) => {
          const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
          if (listMatch !== null) {
            const tab = listMatch[1];
            return {
              ok: true,
              status: 200,
              json: async () =>
                tab === 'stories' ? storiesTabPayload() : listPayload(tab),
            };
          }
          if (url === '/api/projects') {
            return {
              ok: true,
              status: 200,
              json: async () => ({ pjcodes: ['acme'] }),
            };
          }
          if (url === '/api/createissue') {
            const requestBody = JSON.parse(options?.body ?? '{}') as {
              title: string;
            };
            const issueUrl =
              requestBody.title === 'Task A'
                ? 'https://github.com/o/r/issues/801'
                : 'https://github.com/o/r/issues/802';
            return {
              ok: true,
              status: 200,
              json: async () => ({ issueUrl }),
            };
          }
          if (url === '/api/upload') {
            const requestBody = JSON.parse(options?.body ?? '{}') as {
              fileName: string;
            };
            return {
              ok: true,
              status: 200,
              json: async () => ({
                markdown: `![${requestBody.fileName}](https://example.com/${requestBody.fileName})`,
              }),
            };
          }
          if (url === '/api/comment') {
            const requestBody = JSON.parse(options?.body ?? '{}') as {
              url: string;
              body: string;
            };
            return {
              ok: true,
              status: 200,
              json: async () => ({
                comment: {
                  id: 1,
                  author: 'bot',
                  body: requestBody.body,
                  createdAt: '2026-06-19T00:00:00.000Z',
                },
              }),
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

      const attachFile = async (fileName: string): Promise<void> => {
        const testFile = new File(['x'], fileName, { type: 'image/png' });
        (
          testFile as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }
        ).arrayBuffer = async () => new Uint8Array([120]).buffer;
        const fileInput = document.querySelector(
          'input[type="file"]',
        ) as HTMLInputElement;
        Object.defineProperty(fileInput, 'files', {
          value: [testFile],
          configurable: true,
        });
        await act(async () => {
          fireEvent.change(fileInput);
        });
        await waitFor(() => {
          expect(
            document.querySelector('.console-task-create-dialog-file-name'),
          ).toBeInTheDocument();
        });
      };

      const { getByRole, queryByRole } = render(<ConsolePage />);

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });

      fireEvent.click(getByRole('button', { name: 'Create new task' }));
      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });
      const dialogA = getByRole('dialog', { name: 'Create new task' });
      fireEvent.change(within(dialogA).getByLabelText('Title'), {
        target: { value: 'Task A' },
      });
      await attachFile('a.png');

      fireEvent.click(within(dialogA).getByRole('button', { name: 'Create' }));

      await waitFor(() => {
        expect(queryByRole('dialog', { name: 'Create new task' })).toBeNull();
      });

      fireEvent.click(getByRole('button', { name: 'Create new task' }));
      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });
      const dialogB = getByRole('dialog', { name: 'Create new task' });
      expect(within(dialogB).getByLabelText('Title')).toHaveValue('');
      fireEvent.change(within(dialogB).getByLabelText('Title'), {
        target: { value: 'Task B' },
      });
      await attachFile('b.png');

      fireEvent.click(within(dialogB).getByRole('button', { name: 'Create' }));

      await act(async () => {
        jest.advanceTimersByTime(5100);
        for (let i = 0; i < 20; i++) {
          await Promise.resolve();
        }
      });

      const createIssueCalls = fetchMock.mock.calls.filter(
        (call) => call[0] === '/api/createissue',
      );
      expect(createIssueCalls.length).toBe(2);

      const commentRequestBodies = fetchMock.mock.calls
        .filter((call) => call[0] === '/api/comment')
        .map(
          (call) =>
            JSON.parse(call[1]?.body ?? '{}') as { url: string; body: string },
        );
      const commentForTaskA = commentRequestBodies.find(
        (c) => c.url === 'https://github.com/o/r/issues/801',
      );
      const commentForTaskB = commentRequestBodies.find(
        (c) => c.url === 'https://github.com/o/r/issues/802',
      );

      expect(commentForTaskA?.body ?? '').toContain('a.png');
      expect(commentForTaskA?.body ?? '').not.toContain('b.png');
      expect(commentForTaskB?.body ?? '').toContain('b.png');
      expect(commentForTaskB?.body ?? '').not.toContain('a.png');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ConsolePage story selection auto-reset', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
  });

  it('resets the story selection in the create-task dialog to the first story when the story list changes', async () => {
    jest.useFakeTimers();
    try {
      let currentStoryOptionId = 'st1';
      let currentStoryName = 'TDPM Console port';
      const fetchMock = jest.fn(async (url: string) => {
        const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
        if (listMatch !== null) {
          const tab = listMatch[1];
          if (tab === 'stories') {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                ...listPayload('stories'),
                defaultNameWithOwner: 'o/r',
                stories: [
                  {
                    storyName: currentStoryName,
                    storyOptionId: currentStoryOptionId,
                    color: 'BLUE',
                    openItemCount: 1,
                    storyViewUrl: null,
                  },
                ],
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
        return {
          ok: true,
          status: 200,
          json: async () => ({ body: '# body' }),
        };
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { getByRole } = render(<ConsolePage />);

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });

      fireEvent.click(getByRole('button', { name: 'Create new task' }));

      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });

      const dialog = getByRole('dialog', { name: 'Create new task' });
      expect(
        within(dialog)
          .getByText('TDPM Console port')
          .closest('button')
          ?.getAttribute('aria-pressed'),
      ).toBe('true');

      currentStoryOptionId = 'st2';
      currentStoryName = 'New project story';

      await act(async () => {
        jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
      });

      await waitFor(() => {
        expect(
          within(getByRole('dialog', { name: 'Create new task' }))
            .getByText('New project story')
            .closest('button')
            ?.getAttribute('aria-pressed'),
        ).toBe('true');
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ConsolePage workflow issue creation', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
  });

  const installFetchWithFleetUrl = (
    fleetTaskCreateUrl: string | null,
    createIssueOk = true,
    workflowLists: {
      workflowStoryEntries: unknown[];
      workflowAgentOptions: unknown[];
    } | null = null,
  ) => {
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        return {
          ok: true,
          status: 200,
          json: async () =>
            tab === 'stories'
              ? { ...listPayload(tab), defaultNameWithOwner: 'o/r' }
              : listPayload(tab),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () =>
            fleetTaskCreateUrl !== null
              ? {
                  pjcodes: ['acme'],
                  fleetTaskCreateUrl,
                  ...(workflowLists ?? {}),
                }
              : { pjcodes: ['acme'] },
        };
      }
      if (url.startsWith('/api/projectreadmeconfig')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ maximumPreparingIssuesCount: 3 }),
        };
      }
      if (url.startsWith('/api/comments')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            comments: [
              {
                author: 'bot',
                body: 'Workflow test comment body.',
                createdAt: '2026-06-19T00:00:00.000Z',
              },
            ],
          }),
        };
      }
      if (url === '/api/createissue') {
        if (!createIssueOk) {
          return {
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error',
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            issueUrl: 'https://github.com/HiromiShikata/secretary/issues/100',
          }),
        };
      }
      if (url === '/api/upload') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            markdown: '![test.png](https://example.com/test.png)',
          }),
        };
      }
      if (url === '/api/comment') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            comment: {
              author: 'bot',
              body: '![test.png](https://example.com/test.png)',
              createdAt: '2026-06-19T00:00:00.000Z',
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
  };

  it('does not render the create workflow issue button when fleetTaskCreateUrl is null', async () => {
    installFetchWithFleetUrl(null);
    const { getByText, queryAllByTitle } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add serveConsole subcommand'));
    await waitFor(() => {
      expect(getByText('Workflow test comment body.')).toBeInTheDocument();
    });
    expect(
      queryAllByTitle('Create workflow improvement issue from this comment'),
    ).toHaveLength(0);
  });

  it('renders the create workflow issue button on a comment when fleetTaskCreateUrl is non-null', async () => {
    installFetchWithFleetUrl(
      'https://github.com/HiromiShikata/secretary/issues/new',
    );
    const { getByText, getAllByTitle } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add serveConsole subcommand'));
    await waitFor(() => {
      expect(
        getAllByTitle('Create workflow improvement issue from this comment')
          .length,
      ).toBeGreaterThan(0);
    });
  });

  it('pre-populates the comment-triggered create-task dialog with empty title and comment body as blockquote prefixed by item url and title', async () => {
    installFetchWithFleetUrl(
      'https://github.com/HiromiShikata/secretary/issues/new',
    );
    const { getByText, getAllByTitle, getByRole, getByLabelText } = render(
      <ConsolePage />,
    );
    await waitFor(() => {
      expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Add serveConsole subcommand'));
    await waitFor(() => {
      expect(
        getAllByTitle('Create workflow improvement issue from this comment')
          .length,
      ).toBeGreaterThan(0);
    });
    const createBtn = getAllByTitle(
      'Create workflow improvement issue from this comment',
    )[0];
    fireEvent.click(createBtn);
    await waitFor(() => {
      expect(getByRole('dialog')).toBeInTheDocument();
    });
    expect((getByLabelText('Title') as HTMLTextAreaElement).value).toBe('');
    expect((getByLabelText('Body') as HTMLTextAreaElement).value).toBe(
      'https://github.com/o/r/pull/851\n\nAdd serveConsole subcommand\n\n\n\n\n\n> Workflow test comment body.',
    );
  });

  it('closes the comment-triggered dialog and shows undo toast when Create is clicked', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFleetUrl(
        'https://github.com/HiromiShikata/secretary/issues/new',
      );
      const {
        getByText,
        getAllByTitle,
        getByRole,
        queryByRole,
        getByLabelText,
      } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      fireEvent.click(getByText('Add serveConsole subcommand'));
      await waitFor(() => {
        expect(
          getAllByTitle('Create workflow improvement issue from this comment')
            .length,
        ).toBeGreaterThan(0);
      });
      const createBtn = getAllByTitle(
        'Create workflow improvement issue from this comment',
      )[0];
      fireEvent.click(createBtn);
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      fireEvent.change(getByLabelText('Title'), {
        target: { value: 'New workflow task' },
      });
      fireEvent.click(getByRole('button', { name: 'Create' }));
      await waitFor(() => {
        expect(queryByRole('dialog')).toBeNull();
      });
      expect(
        getByText(/Creating task — "New workflow task"/),
      ).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('calls postConsoleCreateIssue with correct nameWithOwner after the undo window elapses', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFleetUrl(
        'https://github.com/HiromiShikata/secretary/issues/new',
      );
      const fetchSpy = global.fetch as jest.Mock;
      const { getByText, getAllByTitle, getByRole, getByLabelText } = render(
        <ConsolePage />,
      );
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      fireEvent.click(getByText('Add serveConsole subcommand'));
      await waitFor(() => {
        expect(
          getAllByTitle('Create workflow improvement issue from this comment')
            .length,
        ).toBeGreaterThan(0);
      });
      const createBtn = getAllByTitle(
        'Create workflow improvement issue from this comment',
      )[0];
      fireEvent.click(createBtn);
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      fireEvent.change(getByLabelText('Title'), {
        target: { value: 'My fleet task' },
      });
      fireEvent.click(getByRole('button', { name: 'Create' }));
      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });
      const createIssueCalls = fetchSpy.mock.calls.filter(
        ([callUrl]: [string]) => callUrl === '/api/createissue',
      );
      expect(createIssueCalls.length).toBeGreaterThan(0);
      const requestBody = JSON.parse(
        (createIssueCalls[0][1] as RequestInit).body as string,
      ) as Record<string, unknown>;
      expect(requestBody.nameWithOwner).toBe('HiromiShikata/secretary');
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows an error toast when postConsoleCreateIssue fails after the undo window elapses', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFleetUrl(
        'https://github.com/HiromiShikata/secretary/issues/new',
        false,
      );
      const { getByText, getAllByTitle, getByRole, getByLabelText } = render(
        <ConsolePage />,
      );
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      fireEvent.click(getByText('Add serveConsole subcommand'));
      await waitFor(() => {
        expect(
          getAllByTitle('Create workflow improvement issue from this comment')
            .length,
        ).toBeGreaterThan(0);
      });
      const createBtn = getAllByTitle(
        'Create workflow improvement issue from this comment',
      )[0];
      fireEvent.click(createBtn);
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      fireEvent.change(getByLabelText('Title'), {
        target: { value: 'Failing task' },
      });
      fireEvent.click(getByRole('button', { name: 'Create' }));
      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(
          getByText(
            'Operation failed: Failed to create the task. Please try again.',
          ),
        ).toBeInTheDocument();
      });
      const reopenedDialog = getByRole('dialog');
      expect(reopenedDialog).toBeInTheDocument();
      expect(getByLabelText('Title')).toHaveValue('Failing task');
      expect(
        getByRole('button', { name: 'Workflow' }).getAttribute('aria-pressed'),
      ).toBe('true');
      expect(within(reopenedDialog).getByRole('alert').textContent).toBe(
        'Failed to create the task. Please try again.',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('passes storyName and agentOptionId to postConsoleCreateIssue when selected in comment dialog', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFleetUrl(
        'https://github.com/HiromiShikata/secretary/issues/new',
      );
      const fetchSpy = global.fetch as jest.Mock;
      const { getByText, getAllByTitle, getByRole, getByLabelText } = render(
        <ConsolePage />,
      );
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      fireEvent.click(getByText('Add serveConsole subcommand'));
      await waitFor(() => {
        expect(
          getAllByTitle('Create workflow improvement issue from this comment')
            .length,
        ).toBeGreaterThan(0);
      });
      const createBtn = getAllByTitle(
        'Create workflow improvement issue from this comment',
      )[0];
      fireEvent.click(createBtn);
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      const dialog = getByRole('dialog');
      fireEvent.click(within(dialog).getByText('developer'));
      fireEvent.change(getByLabelText('Title'), {
        target: { value: 'Story agent task' },
      });
      fireEvent.click(getByRole('button', { name: 'Create' }));
      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });
      const createIssueCalls = fetchSpy.mock.calls.filter(
        ([callUrl]: [string]) => callUrl === '/api/createissue',
      );
      expect(createIssueCalls.length).toBeGreaterThan(0);
      const requestBody = JSON.parse(
        (createIssueCalls[0][1] as RequestInit).body as string,
      ) as Record<string, unknown>;
      expect(requestBody.storyName).toBe('TDPM Console port');
      expect(requestBody.agentOptionId).toBe('ag1');
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows an undo toast after fleet task dialog is submitted', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFleetUrl(
        'https://github.com/HiromiShikata/secretary/issues/new',
      );
      const { getByRole, queryByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getByRole('button', { name: 'Create fleet task' }),
        ).toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      fireEvent.change(getByRole('textbox', { name: /title/i }), {
        target: { value: 'My fleet task' },
      });
      fireEvent.click(getByRole('button', { name: /^create$/i }));
      await waitFor(() => {
        expect(queryByText(/Creating task/)).toBeInTheDocument();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('calls postConsoleCreateIssue with correct nameWithOwner and title when fleet task dialog is submitted', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFleetUrl(
        'https://github.com/HiromiShikata/secretary/issues/new',
      );
      const fetchSpy = global.fetch as jest.Mock;
      const { getByRole } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getByRole('button', { name: 'Create fleet task' }),
        ).toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      fireEvent.change(getByRole('textbox', { name: /title/i }), {
        target: { value: 'My fleet task' },
      });
      fireEvent.click(getByRole('button', { name: /^create$/i }));
      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });
      const createIssueCalls = fetchSpy.mock.calls.filter(
        ([callUrl]: [string]) => callUrl === '/api/createissue',
      );
      expect(createIssueCalls.length).toBeGreaterThan(0);
      const requestBody = JSON.parse(
        (createIssueCalls[0][1] as RequestInit).body as string,
      ) as Record<string, unknown>;
      expect(requestBody.nameWithOwner).toBe('HiromiShikata/secretary');
      expect(requestBody.title).toBe('My fleet task');
      expect(requestBody.storyName).toBe('TDPM Console port');
    } finally {
      jest.useRealTimers();
    }
  });

  it('reopens the header "Create fleet task" dialog with retained values and the failure reason when its own create request fails after the undo window elapses', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFleetUrl(
        'https://github.com/HiromiShikata/secretary/issues/new',
        false,
      );
      const { getByRole } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getByRole('button', { name: 'Create fleet task' }),
        ).toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      fireEvent.change(getByRole('textbox', { name: /title/i }), {
        target: { value: 'Failing fleet task' },
      });
      fireEvent.click(getByRole('button', { name: /^create$/i }));
      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      const fleetDialogContainer = document.body.querySelector(
        '.console-fleet-task-create-dialog-container',
      );
      expect(fleetDialogContainer).not.toBeNull();
      const reopenedDialog = within(
        fleetDialogContainer as HTMLElement,
      ).getByRole('dialog');
      expect(within(reopenedDialog).getByLabelText('Title')).toHaveValue(
        'Failing fleet task',
      );
      expect(
        within(reopenedDialog)
          .getByRole('button', { name: 'Workflow' })
          .getAttribute('aria-pressed'),
      ).toBe('true');
      expect(within(reopenedDialog).getByRole('alert').textContent).toBe(
        'Failed to create the task. Please try again.',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('switches an explicitly selected current project to the first candidate project with actionable items once the live refresh leaves it with zero actionable items', async () => {
    localStorage.setItem(
      'tdpm-timer-settings',
      JSON.stringify({
        timerMode: true,
        projectMinutes: { acme: 30, beta: 30 },
      }),
    );
    let todoCallCount = 0;
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        if (tab === 'todo-by-human') {
          todoCallCount += 1;
          return {
            ok: true,
            status: 200,
            json: async () =>
              todoCallCount === 1
                ? listPayload('todo-by-human')
                : { ...listPayload('todo-by-human'), items: [] },
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ ...listPayload(tab), items: [] }),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            pjcodes: ['acme', 'beta'],
            actionableCounts: actionableCountsWithBetaTodoByHumanItem,
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
    const { navigatePush } = jest.requireMock<{
      navigatePush: jest.Mock;
    }>('../lib/navigation');
    navigatePush.mockClear();
    jest.useFakeTimers();
    try {
      const { queryByText } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          queryByText('Notify finished issue preparation'),
        ).toBeInTheDocument();
      });
      expect(navigatePush).not.toHaveBeenCalledWith(
        '/projects/beta/todo-by-human',
      );

      const pjnameBtn = document.querySelector('.console-tab-pjname-button');
      expect(pjnameBtn).not.toBeNull();
      fireEvent.click(pjnameBtn as Element);
      const menuItems = Array.from(
        document.querySelectorAll('[role="menuitem"]'),
      );
      const acmeItem = menuItems.find((el) => el.textContent === 'acme');
      expect(acmeItem).not.toBeUndefined();
      fireEvent.click(acmeItem as Element);

      expect(navigatePush).toHaveBeenCalledWith('/projects/acme');
      navigatePush.mockClear();

      await act(async () => {
        jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
      });
      await waitFor(() => {
        expect(
          queryByText('Notify finished issue preparation'),
        ).not.toBeInTheDocument();
      });
      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
      expect(navigatePush).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('strips query string from fleetTaskCreateUrl when extracting nameWithOwner for fleet task dialog', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFleetUrl(
        'https://github.com/owner/repo/issues/new?projects=org/3',
      );
      const fetchSpy = global.fetch as jest.Mock;
      const { getByRole } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getByRole('button', { name: 'Create fleet task' }),
        ).toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      fireEvent.change(getByRole('textbox', { name: /title/i }), {
        target: { value: 'Task with query string url' },
      });
      fireEvent.click(getByRole('button', { name: /^create$/i }));
      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });
      const createIssueCalls = fetchSpy.mock.calls.filter(
        ([callUrl]: [string]) => callUrl === '/api/createissue',
      );
      expect(createIssueCalls.length).toBeGreaterThan(0);
      const requestBody = JSON.parse(
        (createIssueCalls[0][1] as RequestInit).body as string,
      ) as Record<string, unknown>;
      expect(requestBody.nameWithOwner).toBe('owner/repo');
    } finally {
      jest.useRealTimers();
    }
  });

  it('preserves the draft title when the fleet task dialog is closed without creating', async () => {
    installFetchWithFleetUrl(
      'https://github.com/HiromiShikata/secretary/issues/new',
    );
    const { getByRole, queryByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getByRole('button', { name: 'Create fleet task' }),
      ).toBeInTheDocument();
    });
    fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
    await waitFor(() => {
      expect(getByRole('dialog')).toBeInTheDocument();
    });
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Draft fleet task' },
    });
    fireEvent.click(getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(queryByRole('dialog')).not.toBeInTheDocument();
    });
    fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
    await waitFor(() => {
      expect(getByRole('dialog')).toBeInTheDocument();
    });
    expect(getByRole('textbox', { name: /title/i })).toHaveValue(
      'Draft fleet task',
    );
  });

  it('resets the draft title to empty after the fleet task dialog is submitted', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFleetUrl(
        'https://github.com/HiromiShikata/secretary/issues/new',
      );
      const { getByRole, queryByRole } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getByRole('button', { name: 'Create fleet task' }),
        ).toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      fireEvent.change(getByRole('textbox', { name: /title/i }), {
        target: { value: 'Fleet task to submit' },
      });
      fireEvent.click(getByRole('button', { name: /^create$/i }));
      await waitFor(() => {
        expect(queryByRole('dialog')).not.toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      expect(getByRole('textbox', { name: /title/i })).toHaveValue('');
    } finally {
      jest.useRealTimers();
    }
  });

  it('uploads file attachments and posts comment when fleet task dialog includes files', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFleetUrl(
        'https://github.com/HiromiShikata/secretary/issues/new',
      );
      const fetchSpy = global.fetch as jest.Mock;
      const { getByRole } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getByRole('button', { name: 'Create fleet task' }),
        ).toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      fireEvent.change(getByRole('textbox', { name: /title/i }), {
        target: { value: 'Fleet task with file' },
      });
      const testFile = new File(['hello'], 'test.png', { type: 'image/png' });
      (
        testFile as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }
      ).arrayBuffer = async () =>
        new Uint8Array([104, 101, 108, 108, 111]).buffer;
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [testFile],
        configurable: true,
      });
      await act(async () => {
        fireEvent.change(fileInput);
      });
      await waitFor(() => {
        expect(
          document.querySelector('.console-task-create-dialog-file-name'),
        ).toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: /^create$/i }));
      await act(async () => {
        jest.advanceTimersByTime(5100);
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
        }
      });
      const uploadCalls = fetchSpy.mock.calls.filter(
        ([callUrl]: [string]) => callUrl === '/api/upload',
      );
      expect(uploadCalls.length).toBeGreaterThan(0);
      const commentCalls = fetchSpy.mock.calls.filter(
        ([callUrl]: [string]) => callUrl === '/api/comment',
      );
      expect(commentCalls.length).toBeGreaterThan(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('opens the "Create new task" dialog with Project selected as the destination when a workflow repository is configured', async () => {
    installFetchWithFleetUrl(
      'https://github.com/HiromiShikata/secretary/issues/new',
    );
    const { getByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
    });
    fireEvent.click(getByRole('button', { name: 'Create new task' }));
    await waitFor(() => {
      expect(
        getByRole('dialog', { name: 'Create new task' }),
      ).toBeInTheDocument();
    });
    expect(
      getByRole('button', { name: 'Project' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      getByRole('button', { name: 'Workflow' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('omits the Workflow destination option from the "Create new task" dialog when no workflow repository is configured', async () => {
    installFetchWithFleetUrl(null);
    const { getByRole, queryByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
    });
    fireEvent.click(getByRole('button', { name: 'Create new task' }));
    await waitFor(() => {
      expect(
        getByRole('dialog', { name: 'Create new task' }),
      ).toBeInTheDocument();
    });
    expect(getByRole('button', { name: 'Project' })).toBeInTheDocument();
    expect(queryByRole('button', { name: 'Workflow' })).toBeNull();
  });

  it('opens the "Create fleet task" dialog with Workflow selected as the destination', async () => {
    installFetchWithFleetUrl(
      'https://github.com/HiromiShikata/secretary/issues/new',
    );
    const { getByRole } = render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getByRole('button', { name: 'Create fleet task' }),
      ).toBeInTheDocument();
    });
    fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
    await waitFor(() => {
      expect(getByRole('dialog')).toBeInTheDocument();
    });
    expect(
      getByRole('button', { name: 'Workflow' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      getByRole('button', { name: 'Project' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('sends the create request to the workflow repository when the destination is switched to Workflow from the "Create new task" dialog', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFleetUrl(
        'https://github.com/HiromiShikata/secretary/issues/new',
      );
      const fetchSpy = global.fetch as jest.Mock;
      const { getByRole } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });
      fireEvent.click(getByRole('button', { name: 'Create new task' }));
      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: 'Workflow' }));
      fireEvent.change(getByRole('textbox', { name: /title/i }), {
        target: { value: 'Switched to workflow task' },
      });
      fireEvent.click(getByRole('button', { name: /^create$/i }));
      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });
      const createIssueCalls = fetchSpy.mock.calls.filter(
        ([callUrl]: [string]) => callUrl === '/api/createissue',
      );
      expect(createIssueCalls.length).toBeGreaterThan(0);
      const requestBody = JSON.parse(
        (createIssueCalls[0][1] as RequestInit).body as string,
      ) as Record<string, unknown>;
      expect(requestBody.nameWithOwner).toBe('HiromiShikata/secretary');
      expect(requestBody.title).toBe('Switched to workflow task');
    } finally {
      jest.useRealTimers();
    }
  });

  it('sends the create request to the current project\'s own repository when the destination is switched to Project from the "Create fleet task" dialog', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFleetUrl(
        'https://github.com/HiromiShikata/secretary/issues/new',
      );
      const fetchSpy = global.fetch as jest.Mock;
      const { getByRole } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getByRole('button', { name: 'Create fleet task' }),
        ).toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: 'Project' }));
      fireEvent.change(getByRole('textbox', { name: /title/i }), {
        target: { value: 'Switched to project task' },
      });
      fireEvent.click(getByRole('button', { name: /^create$/i }));
      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });
      const createIssueCalls = fetchSpy.mock.calls.filter(
        ([callUrl]: [string]) => callUrl === '/api/createissue',
      );
      expect(createIssueCalls.length).toBeGreaterThan(0);
      const requestBody = JSON.parse(
        (createIssueCalls[0][1] as RequestInit).body as string,
      ) as Record<string, unknown>;
      expect(requestBody.nameWithOwner).toBe('o/r');
      expect(requestBody.title).toBe('Switched to project task');
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders both header task-creation buttons when a workflow repository is configured, and only the "Create new task" button when it is not', async () => {
    installFetchWithFleetUrl(
      'https://github.com/HiromiShikata/secretary/issues/new',
    );
    const { getByRole, unmount } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
    });
    expect(
      getByRole('button', { name: 'Create fleet task' }),
    ).toBeInTheDocument();
    unmount();

    installFetchWithFleetUrl(null);
    const { getByRole: getByRoleNoFleet, queryByRole: queryByRoleNoFleet } =
      render(<ConsolePage />);
    await waitFor(() => {
      expect(
        getByRoleNoFleet('button', { name: 'Create new task' }),
      ).toBeEnabled();
    });
    expect(
      queryByRoleNoFleet('button', { name: 'Create fleet task' }),
    ).toBeNull();
  });

  it('posts a storyName/agentOptionId taken from workflowStoryEntries/workflowAgentOptions, not the viewed project\'s own lists, when submitting the "Create fleet task" dialog', async () => {
    jest.useFakeTimers();
    try {
      installFetchWithFleetUrl(
        'https://github.com/HiromiShikata/secretary/issues/new',
        true,
        {
          workflowStoryEntries: [
            {
              storyName: 'Fleet task',
              storyOptionId: 'opt-fleet-task',
              color: 'GREEN',
              description: '',
              openItemCount: 0,
              storyViewUrl: null,
              items: [],
            },
          ],
          workflowAgentOptions: [
            {
              id: 'agent-fleet-operator',
              name: 'fleet-operator',
              color: 'PURPLE',
            },
          ],
        },
      );
      const fetchSpy = global.fetch as jest.Mock;
      const { getByRole, queryByRole } = render(<ConsolePage />);
      await waitFor(() => {
        expect(
          getByRole('button', { name: 'Create fleet task' }),
        ).toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });

      expect(getByRole('button', { name: 'Fleet task' })).toBeInTheDocument();
      expect(
        getByRole('button', { name: 'fleet-operator' }),
      ).toBeInTheDocument();
      expect(queryByRole('button', { name: /tdpm console port/i })).toBeNull();

      fireEvent.click(getByRole('button', { name: 'Fleet task' }));
      fireEvent.click(getByRole('button', { name: 'fleet-operator' }));
      fireEvent.change(getByRole('textbox', { name: /title/i }), {
        target: { value: 'Task sourced from workflow lists' },
      });
      fireEvent.click(getByRole('button', { name: /^create$/i }));
      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });
      const createIssueCalls = fetchSpy.mock.calls.filter(
        ([callUrl]: [string]) => callUrl === '/api/createissue',
      );
      expect(createIssueCalls.length).toBeGreaterThan(0);
      const requestBody = JSON.parse(
        (createIssueCalls[0][1] as RequestInit).body as string,
      ) as Record<string, unknown>;
      expect(requestBody.storyName).toBe('Fleet task');
      expect(requestBody.agentOptionId).toBe('agent-fleet-operator');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ConsolePage task-creation failure toast after navigating away before the write confirms (#3491)', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
  });

  const defaultNameWithOwnerByPjcode: Record<string, string> = {
    acme: 'o/r',
    beta: 'other-owner/other-repo',
    gamma: 'third-owner/third-repo',
  };

  const installFetchForNavigatedAwayFailure = (
    fleetTaskCreateUrl: string | null = null,
    createIssueOk = false,
  ): jest.Mock => {
    const fetchMock = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/([^/]+)\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const pjcodeFromUrl = listMatch[1];
        const tab = listMatch[2];
        return {
          ok: true,
          status: 200,
          json: async () =>
            tab === 'stories'
              ? {
                  ...listPayload(tab),
                  defaultNameWithOwner:
                    defaultNameWithOwnerByPjcode[pjcodeFromUrl] ?? null,
                }
              : listPayload(tab),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () =>
            fleetTaskCreateUrl !== null
              ? { pjcodes: ['acme', 'beta', 'gamma'], fleetTaskCreateUrl }
              : { pjcodes: ['acme', 'beta', 'gamma'] },
        };
      }
      if (url.startsWith('/api/projectreadmeconfig')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ maximumPreparingIssuesCount: 3 }),
        };
      }
      if (url === '/api/createissue') {
        if (!createIssueOk) {
          return {
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error',
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            issueUrl: 'https://github.com/o/r/issues/100',
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  const createIssueCallsFrom = (
    fetchMock: jest.Mock,
  ): [string, RequestInit][] =>
    fetchMock.mock.calls.filter(
      ([callUrl]: [string]) => callUrl === '/api/createissue',
    ) as [string, RequestInit][];

  const navigateAwayTo = async (pjcode: string): Promise<void> => {
    await act(async () => {
      window.history.pushState({}, '', `/projects/${pjcode}/prs?k=token`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it('shows the ConsoleErrorToast instead of reopening the Project-destination dialog when the operator navigated away before the write confirms, and keeps showing it through a further navigation to a third project', async () => {
    jest.useFakeTimers();
    try {
      installFetchForNavigatedAwayFailure();
      const { getByRole, queryByRole, container } = render(<ConsolePage />);

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });
      fireEvent.click(getByRole('button', { name: 'Create new task' }));
      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });
      const openDialog = getByRole('dialog', { name: 'Create new task' });
      fireEvent.change(within(openDialog).getByLabelText('Title'), {
        target: { value: 'Navigated-away project task' },
      });
      fireEvent.click(
        within(openDialog).getByRole('button', { name: 'Create' }),
      );

      await waitFor(() => {
        expect(queryByRole('dialog', { name: 'Create new task' })).toBeNull();
      });

      await navigateAwayTo('beta');

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(
          container.querySelector('.console-error-toast-message'),
        ).not.toBeNull();
      });
      expect(
        container.querySelector('.console-error-toast-message')?.textContent,
      ).toBe('Operation failed: Failed to create the task. Please try again.');
      expect(container.querySelector('.console-error-toast-retry')).not.toBe(
        null,
      );
      expect(container.querySelector('.console-error-toast-dismiss')).not.toBe(
        null,
      );
      expect(queryByRole('dialog', { name: 'Create new task' })).toBeNull();

      await navigateAwayTo('gamma');
      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });

      expect(
        container.querySelector('.console-error-toast-message')?.textContent,
      ).toBe('Operation failed: Failed to create the task. Please try again.');
      expect(queryByRole('dialog', { name: 'Create new task' })).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('retries the Project-destination create request to the originally captured project and repository, with every originally entered field intact, when Retry is clicked after navigating away', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = installFetchForNavigatedAwayFailure();
      const { getByRole, queryByRole, container } = render(<ConsolePage />);

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });
      fireEvent.click(getByRole('button', { name: 'Create new task' }));
      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });
      const openDialog = getByRole('dialog', { name: 'Create new task' });
      fireEvent.change(within(openDialog).getByLabelText('Title'), {
        target: { value: 'Retried project task' },
      });
      fireEvent.change(within(openDialog).getByLabelText('Body'), {
        target: { value: 'Body for the retried project task' },
      });
      fireEvent.click(
        within(openDialog).getByRole('button', {
          name: /TDPM Console port/,
        }),
      );
      fireEvent.click(
        within(openDialog).getByRole('button', { name: /^developer$/i }),
      );
      fireEvent.click(
        within(openDialog).getByRole('button', { name: 'Create' }),
      );

      await waitFor(() => {
        expect(queryByRole('dialog', { name: 'Create new task' })).toBeNull();
      });

      await navigateAwayTo('beta');

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      const retryButton = await waitFor(() => {
        const button = container.querySelector('.console-error-toast-retry');
        expect(button).not.toBeNull();
        return button as HTMLElement;
      });
      expect(createIssueCallsFrom(fetchMock).length).toBe(1);

      await act(async () => {
        fireEvent.click(retryButton);
        await Promise.resolve();
        await Promise.resolve();
      });

      const createIssueCalls = createIssueCallsFrom(fetchMock);
      expect(createIssueCalls.length).toBe(2);
      const retriedRequestBody = JSON.parse(
        createIssueCalls[1][1].body as string,
      ) as Record<string, unknown>;
      expect(retriedRequestBody.pjcode).toBe('acme');
      expect(retriedRequestBody.nameWithOwner).toBe('o/r');
      expect(retriedRequestBody.title).toBe('Retried project task');
      expect(retriedRequestBody.body).toBe('Body for the retried project task');
      expect(retriedRequestBody.storyName).toBe('TDPM Console port');
      expect(queryByRole('dialog', { name: 'Create new task' })).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('re-shows the ConsoleErrorToast rather than reopening the Project-destination dialog when the Retry resubmission itself fails again', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = installFetchForNavigatedAwayFailure();
      const { getByRole, queryByRole, container } = render(<ConsolePage />);

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });
      fireEvent.click(getByRole('button', { name: 'Create new task' }));
      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });
      const openDialog = getByRole('dialog', { name: 'Create new task' });
      fireEvent.change(within(openDialog).getByLabelText('Title'), {
        target: { value: 'Double-failing project task' },
      });
      fireEvent.click(
        within(openDialog).getByRole('button', { name: 'Create' }),
      );

      await waitFor(() => {
        expect(queryByRole('dialog', { name: 'Create new task' })).toBeNull();
      });

      await navigateAwayTo('beta');

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      const retryButton = await waitFor(() => {
        const button = container.querySelector('.console-error-toast-retry');
        expect(button).not.toBeNull();
        return button as HTMLElement;
      });

      await act(async () => {
        fireEvent.click(retryButton);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(createIssueCallsFrom(fetchMock).length).toBe(2);
      expect(queryByRole('dialog', { name: 'Create new task' })).toBeNull();
      await waitFor(() => {
        expect(
          container.querySelector('.console-error-toast-message'),
        ).not.toBeNull();
      });
      expect(container.querySelector('.console-error-toast-retry')).not.toBe(
        null,
      );
      expect(container.querySelector('.console-error-toast-dismiss')).not.toBe(
        null,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('removes the ConsoleErrorToast without resubmitting when Dismiss is clicked after navigating away from a failed Project-destination creation', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = installFetchForNavigatedAwayFailure();
      const { getByRole, queryByRole, container } = render(<ConsolePage />);

      await waitFor(() => {
        expect(getByRole('button', { name: 'Create new task' })).toBeEnabled();
      });
      fireEvent.click(getByRole('button', { name: 'Create new task' }));
      await waitFor(() => {
        expect(
          getByRole('dialog', { name: 'Create new task' }),
        ).toBeInTheDocument();
      });
      const openDialog = getByRole('dialog', { name: 'Create new task' });
      fireEvent.change(within(openDialog).getByLabelText('Title'), {
        target: { value: 'Dismissed project task' },
      });
      fireEvent.click(
        within(openDialog).getByRole('button', { name: 'Create' }),
      );

      await waitFor(() => {
        expect(queryByRole('dialog', { name: 'Create new task' })).toBeNull();
      });

      await navigateAwayTo('beta');

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(
          container.querySelector('.console-error-toast-message'),
        ).not.toBeNull();
      });
      expect(queryByRole('dialog', { name: 'Create new task' })).toBeNull();

      const dismissButton = container.querySelector(
        '.console-error-toast-dismiss',
      ) as HTMLElement;
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(
          container.querySelector('.console-error-toast-message'),
        ).toBeNull();
      });
      expect(createIssueCallsFrom(fetchMock).length).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the ConsoleErrorToast instead of reopening the Workflow-destination dialog when the operator navigated away before the write confirms', async () => {
    jest.useFakeTimers();
    try {
      installFetchForNavigatedAwayFailure(
        'https://github.com/HiromiShikata/secretary/issues/new',
      );
      const { getByRole, container } = render(<ConsolePage />);

      await waitFor(() => {
        expect(
          getByRole('button', { name: 'Create fleet task' }),
        ).toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      fireEvent.change(getByRole('textbox', { name: /title/i }), {
        target: { value: 'Navigated-away fleet task' },
      });
      fireEvent.click(getByRole('button', { name: /^create$/i }));

      await waitFor(() => {
        expect(
          document.body.querySelector(
            '.console-fleet-task-create-dialog-container',
          ),
        ).toBeNull();
      });

      await navigateAwayTo('beta');

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(
          container.querySelector('.console-error-toast-message'),
        ).not.toBeNull();
      });
      expect(
        container.querySelector('.console-error-toast-message')?.textContent,
      ).toBe('Operation failed: Failed to create the task. Please try again.');
      expect(container.querySelector('.console-error-toast-retry')).not.toBe(
        null,
      );
      expect(container.querySelector('.console-error-toast-dismiss')).not.toBe(
        null,
      );
      expect(
        document.body.querySelector(
          '.console-fleet-task-create-dialog-container',
        ),
      ).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('retries the Workflow-destination create request to the originally captured project and workflow repository, with every originally entered field intact, when Retry is clicked after navigating away', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = installFetchForNavigatedAwayFailure(
        'https://github.com/HiromiShikata/secretary/issues/new',
      );
      const { getByRole, container } = render(<ConsolePage />);

      await waitFor(() => {
        expect(
          getByRole('button', { name: 'Create fleet task' }),
        ).toBeInTheDocument();
      });
      fireEvent.click(getByRole('button', { name: 'Create fleet task' }));
      await waitFor(() => {
        expect(getByRole('dialog')).toBeInTheDocument();
      });
      fireEvent.change(getByRole('textbox', { name: /title/i }), {
        target: { value: 'Retried fleet task' },
      });
      fireEvent.change(getByRole('textbox', { name: /body/i }), {
        target: { value: 'Body for the retried fleet task' },
      });
      fireEvent.click(getByRole('button', { name: /^create$/i }));

      await waitFor(() => {
        expect(
          document.body.querySelector(
            '.console-fleet-task-create-dialog-container',
          ),
        ).toBeNull();
      });

      await navigateAwayTo('beta');

      await act(async () => {
        jest.advanceTimersByTime(5100);
        await Promise.resolve();
        await Promise.resolve();
      });

      const retryButton = await waitFor(() => {
        const button = container.querySelector('.console-error-toast-retry');
        expect(button).not.toBeNull();
        return button as HTMLElement;
      });
      expect(createIssueCallsFrom(fetchMock).length).toBe(1);

      await act(async () => {
        fireEvent.click(retryButton);
        await Promise.resolve();
        await Promise.resolve();
      });

      const createIssueCalls = createIssueCallsFrom(fetchMock);
      expect(createIssueCalls.length).toBe(2);
      const retriedRequestBody = JSON.parse(
        createIssueCalls[1][1].body as string,
      ) as Record<string, unknown>;
      expect(retriedRequestBody.pjcode).toBe('acme');
      expect(retriedRequestBody.nameWithOwner).toBe('HiromiShikata/secretary');
      expect(retriedRequestBody.title).toBe('Retried fleet task');
      expect(retriedRequestBody.body).toBe('Body for the retried fleet task');
      expect(
        document.body.querySelector(
          '.console-fleet-task-create-dialog-container',
        ),
      ).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ConsolePage stale cache snapshot tab lock', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/todo-by-human?k=token');
  });

  afterEach(() => {
    Object.defineProperty(global, 'caches', {
      writable: true,
      configurable: true,
      value: undefined,
    });
  });

  it('keeps todo-by-human as the active tab when its snapshot is served from the browser Cache API with zero items while prs has fresh items', async () => {
    const cachedTodoPayload = { ...listPayload('todo-by-human'), items: [] };
    const mockCache = {
      put: jest.fn(),
      match: jest.fn(async (url: string) =>
        url.includes('/todo-by-human/')
          ? new Response(JSON.stringify(cachedTodoPayload), {
              headers: { 'Content-Type': 'application/json' },
            })
          : undefined,
      ),
    };
    Object.defineProperty(global, 'caches', {
      writable: true,
      configurable: true,
      value: { open: jest.fn(async () => mockCache) },
    });

    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        if (tab === 'todo-by-human') {
          throw new Error('Network unavailable');
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
      if (url.startsWith('/api/projectreadmeconfig')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ maximumPreparingIssuesCount: 3 }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;

    render(<ConsolePage />);

    await waitFor(() => {
      expect(
        within(tabBar())
          .getByText('Awaiting Owner')
          .closest('a')
          ?.querySelector('.console-tab-badge')?.textContent,
      ).toBe('1');
    });
    await act(async () => {});
    expect(window.location.pathname).toBe('/projects/acme/todo-by-human');
  });
});

describe('ConsolePage selected item story color threading', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/todo-by-human?k=token');
  });

  it('threads the resolved story option id of the selected item into the detail color lookup instead of the colliding display name', async () => {
    const collidingTodoByHumanPayload = {
      pjcode: 'acme',
      generatedAt: '2026-06-19T00:00:00.000Z',
      statusOptions: [{ id: 's1', name: 'Todo by human', color: 'BLUE' }],
      agentOptions: [],
      storyOptions: [
        { id: 'story-option-xyz', name: 'Collision Story', color: 'PURPLE' },
      ],
      storyColors: {
        'Collision Story': { color: 'RED' },
        'story-option-xyz': { color: 'PURPLE' },
      },
      stories: [],
      items: [
        {
          number: 900,
          title: 'Item with colliding story name',
          url: 'https://github.com/o/r/issues/900',
          repo: 'o/r',
          nameWithOwner: 'o/r',
          projectItemId: 'PVTI_900',
          itemId: 'PVTI_900',
          isPr: false,
          relatedOpenPullRequestUrls: [],
          story: 'Collision Story',
          storyOptionId: 'story-option-xyz',
          status: 'Todo by human',
          nextActionDate: null,
          nextActionHour: null,
          dependedIssueUrls: [],
          labels: [],
          createdAt: '2026-06-19T00:00:00.000Z',
        },
      ],
    };
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tab = listMatch[1];
        if (tab === 'todo-by-human') {
          return {
            ok: true,
            status: 200,
            json: async () => collidingTodoByHumanPayload,
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

    const { getByText, container } = render(<ConsolePage />);
    await waitFor(() => {
      expect(getByText('Item with colliding story name')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Item with colliding story name'));
    await waitFor(() => {
      expect(container.querySelector('.console-story-dot')).not.toBeNull();
    });
    const dot = container.querySelector('.console-story-dot') as HTMLElement;
    expect(dot).toHaveStyle({ backgroundColor: colorFromEnum('PURPLE').dot });
    expect(dot.style.backgroundColor).not.toBe(colorFromEnum('RED').dot);
  });
});

describe('ConsolePage offline action queue', () => {
  const OFFLINE_QUEUE_STORAGE_KEY = 'console-offline-action-queue';
  const pullRequestUrl = 'https://github.com/o/r/pull/851';
  const issueUrl = 'https://github.com/o/r/issues/866';

  type PostResponder = (url: string, init: RequestInit) => Promise<unknown>;

  const readStoredOfflineQueue = (): Record<string, unknown>[] =>
    JSON.parse(localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY) ?? '[]');

  const respondWithPostedComment: PostResponder = async (_url, init) => ({
    ok: true,
    status: 200,
    json: async () => ({
      comment: {
        id: 7,
        author: 'you',
        body: (JSON.parse(String(init.body)) as { body: string }).body,
        createdAt: '2026-06-19T02:00:00.000Z',
      },
    }),
  });

  const respondWithNetworkFailure: PostResponder = async () => {
    throw new TypeError('Failed to fetch');
  };

  const installOfflineQueueFetch = (
    respondToPost: PostResponder,
  ): jest.Mock => {
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return respondToPost(url, init);
      }
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
      if (url.startsWith('/api/projectreadmeconfig')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ maximumPreparingIssuesCount: 3 }),
        };
      }
      if (url.startsWith('/api/issuetitle')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            state: 'open',
            merged: false,
            isPullRequest: false,
            title: 'Notify finished issue preparation',
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  const postedRequestBodies = (
    fetchMock: jest.Mock,
    apiPath: string,
  ): unknown[] =>
    fetchMock.mock.calls
      .filter(
        ([url, init]) =>
          String(url).endsWith(apiPath) &&
          (init as RequestInit | undefined)?.method === 'POST',
      )
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)));

  const postCount = (fetchMock: jest.Mock): number =>
    fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    ).length;

  const openPullRequestDetail = async (
    view: ReturnType<typeof render>,
  ): Promise<void> => {
    await waitFor(() => {
      expect(view.getByText('Add serveConsole subcommand')).toBeInTheDocument();
    });
    fireEvent.click(view.getByText('Add serveConsole subcommand'));
    expect(await view.findByText('Approve & Merge')).toBeInTheDocument();
  };

  const dismissUndoToast = async (container: HTMLElement): Promise<void> => {
    const dismissButton = await waitFor(() => {
      const button = container.querySelector('.console-undo-toast-dismiss');
      expect(button).not.toBeNull();
      return button as HTMLElement;
    });
    fireEvent.click(dismissButton);
  };

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
  });

  it('sends exactly one /api/comment request carrying the project, the item URL and the body when a comment is posted online', async () => {
    const fetchMock = installOfflineQueueFetch(respondWithPostedComment);
    const view = render(<ConsolePage />);
    await openPullRequestDetail(view);

    fireEvent.change(view.getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Looks good from here.' },
    });
    fireEvent.click(view.getByText('Comment'));

    await waitFor(() => {
      expect(view.getByText('Looks good from here.')).toBeInTheDocument();
    });
    expect(postedRequestBodies(fetchMock, '/api/comment')).toEqual([
      { pjcode: 'acme', url: pullRequestUrl, body: 'Looks good from here.' },
    ]);
    expect(readStoredOfflineQueue()).toEqual([]);
  });

  it('shows the host rejection and holds nothing when /api/comment answers HTTP 500 online', async () => {
    const fetchMock = installOfflineQueueFetch(async () => ({
      ok: false,
      status: 500,
      text: async () => '',
    }));
    const view = render(<ConsolePage />);
    await openPullRequestDetail(view);

    fireEvent.change(view.getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Rejected on the merits.' },
    });
    fireEvent.click(view.getByText('Comment'));

    expect(await view.findByText('Failed: HTTP 500.')).toBeInTheDocument();
    expect(postedRequestBodies(fetchMock, '/api/comment')).toHaveLength(1);
    expect(readStoredOfflineQueue()).toEqual([]);
    expect(view.container.querySelector('.console-offline-panel')).toBeNull();
  });

  it('holds a board action in the offline queue without an error toast when its request fails because the network is unavailable', async () => {
    installOfflineQueueFetch(respondWithNetworkFailure);
    const view = render(<ConsolePage />);
    await openPullRequestDetail(view);

    fireEvent.click(view.getByText('Close'));
    await dismissUndoToast(view.container);

    await waitFor(() => {
      expect(readStoredOfflineQueue()).toHaveLength(1);
    });
    expect(readStoredOfflineQueue()[0]).toMatchObject({
      itemUrl: pullRequestUrl,
      apiPath: '/api/triage',
      requestBody: {
        pjcode: 'acme',
        action: 'close',
        issueUrl: pullRequestUrl,
        projectItemId: 'PVTI_1',
      },
    });
    expect(view.container.querySelector('.console-error-toast')).toBeNull();
  });

  it('lists held comments with the other held actions and their re-fetched state on reconnect, sends nothing automatically, and sends exactly one /api/comment request when one is confirmed', async () => {
    const heldItemFields = {
      itemUrl: issueUrl,
      projectItemId: 'PVTI_2',
      itemNumber: 866,
      repo: 'o/r',
      nameWithOwner: 'o/r',
      isPr: false,
    };
    localStorage.setItem(
      OFFLINE_QUEUE_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'held-close',
          message: 'Closed — Issue #866',
          color: 'red',
          enqueuedAt: 1,
          ...heldItemFields,
          apiPath: '/api/triage',
          requestBody: {
            pjcode: 'acme',
            action: 'close',
            issueUrl,
            projectItemId: 'PVTI_2',
          },
        },
        {
          id: 'held-comment',
          message: 'Commented — Issue #866',
          color: 'blue',
          enqueuedAt: 2,
          ...heldItemFields,
          apiPath: '/api/comment',
          requestBody: {
            pjcode: 'acme',
            url: issueUrl,
            body: 'Written while offline.',
          },
        },
      ]),
    );
    let resolveCommentPost: (() => void) | undefined;
    const fetchMock = installOfflineQueueFetch((url) =>
      url.endsWith('/api/comment')
        ? new Promise((resolve) => {
            resolveCommentPost = () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({
                  comment: {
                    id: 7,
                    author: 'you',
                    body: 'Written while offline.',
                    createdAt: '2026-06-19T02:00:00.000Z',
                  },
                }),
              });
          })
        : Promise.resolve({ ok: true, status: 200, json: async () => ({}) }),
    );
    const view = render(<ConsolePage />);

    expect(
      await view.findByText('2 actions held — confirm each before sending'),
    ).toBeInTheDocument();
    expect(view.getByText('Closed — Issue #866')).toBeInTheDocument();
    expect(view.getByText('Commented — Issue #866')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        view.getAllByText('o/r#866 — Notify finished issue preparation (open)'),
      ).toHaveLength(2);
    });
    expect(postCount(fetchMock)).toBe(0);

    const panelItemFor = (message: string): HTMLElement =>
      view
        .getByText(message)
        .closest('.console-offline-panel-item') as HTMLElement;
    fireEvent.click(
      within(panelItemFor('Commented — Issue #866')).getByText('Send'),
    );

    await waitFor(() => {
      expect(
        within(panelItemFor('Closed — Issue #866')).getByText('Send'),
      ).toBeDisabled();
    });
    expect(postedRequestBodies(fetchMock, '/api/comment')).toEqual([
      { pjcode: 'acme', url: issueUrl, body: 'Written while offline.' },
    ]);

    await act(async () => {
      resolveCommentPost?.();
    });

    expect(
      await view.findByText('1 action held — confirm each before sending'),
    ).toBeInTheDocument();
    expect(postedRequestBodies(fetchMock, '/api/comment')).toHaveLength(1);
    expect(postedRequestBodies(fetchMock, '/api/triage')).toHaveLength(0);
    expect(readStoredOfflineQueue().map((held) => held.id)).toEqual([
      'held-close',
    ]);
  });

  it('holds a composer comment with the item URL and body when its request fails because the network is unavailable', async () => {
    const fetchMock = installOfflineQueueFetch(respondWithNetworkFailure);
    const view = render(<ConsolePage />);
    await openPullRequestDetail(view);

    fireEvent.change(view.getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Written in a tunnel.' },
    });
    fireEvent.click(view.getByText('Comment'));

    await waitFor(() => {
      expect(readStoredOfflineQueue()).toEqual([
        expect.objectContaining({
          itemUrl: pullRequestUrl,
          apiPath: '/api/comment',
          requestBody: {
            pjcode: 'acme',
            url: pullRequestUrl,
            body: 'Written in a tunnel.',
          },
        }),
      ]);
    });
    expect(postedRequestBodies(fetchMock, '/api/comment')).toHaveLength(1);
  });

  it('holds both the ok comment and the close of OK & Close in order when its request fails because the network is unavailable', async () => {
    installOfflineQueueFetch(respondWithNetworkFailure);
    const view = render(<ConsolePage />);
    await openPullRequestDetail(view);

    fireEvent.click(view.getByText('OK & Close'));
    await dismissUndoToast(view.container);

    await waitFor(() => {
      expect(readStoredOfflineQueue()).toHaveLength(2);
    });
    expect(readStoredOfflineQueue()).toEqual([
      expect.objectContaining({
        itemUrl: pullRequestUrl,
        apiPath: '/api/comment',
        requestBody: { pjcode: 'acme', url: pullRequestUrl, body: 'ok' },
      }),
      expect.objectContaining({
        itemUrl: pullRequestUrl,
        apiPath: '/api/triage',
        requestBody: {
          pjcode: 'acme',
          action: 'close',
          issueUrl: pullRequestUrl,
          projectItemId: 'PVTI_1',
          expectedStatusName: 'Awaiting Owner',
        },
      }),
    ]);
    expect(view.container.querySelector('.console-error-toast')).toBeNull();
  });

  it('holds the ok comment before the move to Awaiting Workspace when ok & Awaiting Workspace from the list fails because the network is unavailable', async () => {
    installOfflineQueueFetch(respondWithNetworkFailure);
    const view = render(<ConsolePage />);
    const [okAndAwaitingWorkspaceButton] = await view.findAllByRole('button', {
      name: 'ok & Awaiting Workspace',
    });

    fireEvent.click(okAndAwaitingWorkspaceButton);
    await dismissUndoToast(view.container);

    await waitFor(() => {
      expect(readStoredOfflineQueue()).toHaveLength(2);
    });
    expect(readStoredOfflineQueue()).toEqual([
      expect.objectContaining({
        itemUrl: pullRequestUrl,
        apiPath: '/api/comment',
        requestBody: { pjcode: 'acme', url: pullRequestUrl, body: 'ok' },
      }),
      expect.objectContaining({
        itemUrl: pullRequestUrl,
        apiPath: '/api/triage',
        requestBody: {
          pjcode: 'acme',
          action: 'set_status',
          issueUrl: pullRequestUrl,
          projectItemId: 'PVTI_1',
          statusName: 'Awaiting Workspace',
          expectedStatusName: 'Awaiting Owner',
        },
      }),
    ]);
    expect(view.container.querySelector('.console-error-toast')).toBeNull();
  });

  const respondWithOperationSucceeded: PostResponder = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  });

  const respondWithHostRejection: PostResponder = async () => ({
    ok: false,
    status: 500,
    text: async () => '',
  });

  const respondToCommentAsPostedAndOtherRequestsWith =
    (respondToOtherRequests: PostResponder): PostResponder =>
    (url, init) =>
      url.endsWith('/api/comment')
        ? respondWithPostedComment(url, init)
        : respondToOtherRequests(url, init);

  const closeRequestBodyForPullRequest = {
    pjcode: 'acme',
    action: 'close',
    issueUrl: pullRequestUrl,
    projectItemId: 'PVTI_1',
  };

  const closeOfflineRequestBodyForPullRequest = {
    ...closeRequestBodyForPullRequest,
    expectedStatusName: 'Awaiting Owner',
  };

  it('sends the ok comment and the close of OK & Close once each and holds nothing when both requests succeed online', async () => {
    const fetchMock = installOfflineQueueFetch(
      respondToCommentAsPostedAndOtherRequestsWith(
        respondWithOperationSucceeded,
      ),
    );
    const view = render(<ConsolePage />);
    await openPullRequestDetail(view);

    fireEvent.click(view.getByText('OK & Close'));
    await dismissUndoToast(view.container);

    await waitFor(() => {
      expect(postedRequestBodies(fetchMock, '/api/triage')).toHaveLength(1);
    });
    expect(postedRequestBodies(fetchMock, '/api/comment')).toEqual([
      { pjcode: 'acme', url: pullRequestUrl, body: 'ok' },
    ]);
    expect(postedRequestBodies(fetchMock, '/api/triage')).toEqual([
      closeRequestBodyForPullRequest,
    ]);
    expect(readStoredOfflineQueue()).toEqual([]);
    expect(view.container.querySelector('.console-error-toast')).toBeNull();
  });

  it('shows the host rejection and holds nothing when the ok comment of OK & Close was posted and the close answers HTTP 500 online', async () => {
    const fetchMock = installOfflineQueueFetch(
      respondToCommentAsPostedAndOtherRequestsWith(respondWithHostRejection),
    );
    const view = render(<ConsolePage />);
    await openPullRequestDetail(view);

    fireEvent.click(view.getByText('OK & Close'));
    await dismissUndoToast(view.container);

    await waitFor(() => {
      expect(
        view.container.querySelector('.console-error-toast'),
      ).not.toBeNull();
    });
    expect(readStoredOfflineQueue()).toEqual([]);
    expect(view.container.querySelector('.console-offline-panel')).toBeNull();
    expect(postedRequestBodies(fetchMock, '/api/comment')).toEqual([
      { pjcode: 'acme', url: pullRequestUrl, body: 'ok' },
    ]);
    expect(postedRequestBodies(fetchMock, '/api/triage')).toEqual([
      closeRequestBodyForPullRequest,
    ]);
  });

  it('holds both the comment and the close of Comment & Close in order without an error toast when its request fails because the network is unavailable', async () => {
    installOfflineQueueFetch(respondWithNetworkFailure);
    const view = render(<ConsolePage />);
    await openPullRequestDetail(view);

    fireEvent.change(view.getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Closing in a tunnel.' },
    });
    fireEvent.click(view.getByText('Comment & Close'));
    await dismissUndoToast(view.container);

    await waitFor(() => {
      expect(readStoredOfflineQueue()).toHaveLength(2);
    });
    expect(readStoredOfflineQueue()).toEqual([
      expect.objectContaining({
        itemUrl: pullRequestUrl,
        apiPath: '/api/comment',
        requestBody: {
          pjcode: 'acme',
          url: pullRequestUrl,
          body: 'Closing in a tunnel.',
        },
      }),
      expect.objectContaining({
        itemUrl: pullRequestUrl,
        apiPath: '/api/triage',
        requestBody: closeOfflineRequestBodyForPullRequest,
      }),
    ]);
    expect(view.container.querySelector('.console-error-toast')).toBeNull();
  });

  const installFetchPostingCommentsWhileOtherRequestsLoseTheNetwork = (): {
    fetchMock: jest.Mock;
    restoreNetworkForOtherRequests: () => void;
  } => {
    let isNetworkAvailableForOtherRequests = false;
    const respondToOtherRequestsAsSucceeded =
      respondToCommentAsPostedAndOtherRequestsWith(
        respondWithOperationSucceeded,
      );
    const fetchMock = installOfflineQueueFetch((url, init) =>
      url.endsWith('/api/comment') || isNetworkAvailableForOtherRequests
        ? respondToOtherRequestsAsSucceeded(url, init)
        : respondWithNetworkFailure(url, init),
    );
    return {
      fetchMock,
      restoreNetworkForOtherRequests: () => {
        isNetworkAvailableForOtherRequests = true;
      },
    };
  };

  it('holds only the close of OK & Close without an error toast and never posts the ok comment again when the comment was posted, the close fails because the network is unavailable and the held close is confirmed later', async () => {
    const { fetchMock, restoreNetworkForOtherRequests } =
      installFetchPostingCommentsWhileOtherRequestsLoseTheNetwork();
    const view = render(<ConsolePage />);
    await openPullRequestDetail(view);

    fireEvent.click(view.getByText('OK & Close'));
    await dismissUndoToast(view.container);

    await waitFor(() => {
      expect(readStoredOfflineQueue()).not.toEqual([]);
    });
    expect(readStoredOfflineQueue()).toEqual([
      expect.objectContaining({
        itemUrl: pullRequestUrl,
        apiPath: '/api/triage',
        requestBody: closeOfflineRequestBodyForPullRequest,
      }),
    ]);
    expect(view.container.querySelector('.console-error-toast')).toBeNull();
    expect(postedRequestBodies(fetchMock, '/api/comment')).toEqual([
      { pjcode: 'acme', url: pullRequestUrl, body: 'ok' },
    ]);

    restoreNetworkForOtherRequests();
    const heldSendButton = await waitFor(() => {
      const heldItems = view.container.querySelectorAll(
        '.console-offline-panel-item',
      );
      expect(heldItems).toHaveLength(1);
      const sendButton = within(heldItems[0] as HTMLElement).getByText('Send');
      expect(sendButton).toBeEnabled();
      return sendButton;
    });
    fireEvent.click(heldSendButton);

    await waitFor(() => {
      expect(readStoredOfflineQueue()).toEqual([]);
    });
    expect(postedRequestBodies(fetchMock, '/api/comment')).toHaveLength(1);
    expect(postedRequestBodies(fetchMock, '/api/triage')).toEqual([
      closeRequestBodyForPullRequest,
      closeOfflineRequestBodyForPullRequest,
    ]);
  });

  it('holds only the close of Comment & Close without an error toast when the comment was posted and the close fails because the network is unavailable', async () => {
    const { fetchMock } =
      installFetchPostingCommentsWhileOtherRequestsLoseTheNetwork();
    const view = render(<ConsolePage />);
    await openPullRequestDetail(view);

    fireEvent.change(view.getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Posted before the tunnel.' },
    });
    fireEvent.click(view.getByText('Comment & Close'));
    await dismissUndoToast(view.container);

    await waitFor(() => {
      expect(readStoredOfflineQueue()).not.toEqual([]);
    });
    expect(readStoredOfflineQueue()).toEqual([
      expect.objectContaining({
        itemUrl: pullRequestUrl,
        apiPath: '/api/triage',
        requestBody: closeOfflineRequestBodyForPullRequest,
      }),
    ]);
    expect(view.container.querySelector('.console-error-toast')).toBeNull();
    expect(postedRequestBodies(fetchMock, '/api/comment')).toEqual([
      {
        pjcode: 'acme',
        url: pullRequestUrl,
        body: 'Posted before the tunnel.',
      },
    ]);
  });

  it('holds only the move to Awaiting Workspace of ok & Awaiting Workspace from the list without an error toast when the ok comment was posted and the move fails because the network is unavailable', async () => {
    const { fetchMock } =
      installFetchPostingCommentsWhileOtherRequestsLoseTheNetwork();
    const view = render(<ConsolePage />);
    const [okAndAwaitingWorkspaceButton] = await view.findAllByRole('button', {
      name: 'ok & Awaiting Workspace',
    });

    fireEvent.click(okAndAwaitingWorkspaceButton);
    await dismissUndoToast(view.container);

    await waitFor(() => {
      expect(readStoredOfflineQueue()).not.toEqual([]);
    });
    expect(readStoredOfflineQueue()).toEqual([
      expect.objectContaining({
        itemUrl: pullRequestUrl,
        apiPath: '/api/triage',
        requestBody: {
          pjcode: 'acme',
          action: 'set_status',
          issueUrl: pullRequestUrl,
          projectItemId: 'PVTI_1',
          statusName: 'Awaiting Workspace',
          expectedStatusName: 'Awaiting Owner',
        },
      }),
    ]);
    expect(view.container.querySelector('.console-error-toast')).toBeNull();
    expect(postedRequestBodies(fetchMock, '/api/comment')).toEqual([
      { pjcode: 'acme', url: pullRequestUrl, body: 'ok' },
    ]);
  });

  const awaitingWorkspaceRequestBodyForPullRequest = {
    pjcode: 'acme',
    action: 'set_status',
    issueUrl: pullRequestUrl,
    projectItemId: 'PVTI_1',
    statusName: 'Awaiting Workspace',
    expectedStatusName: 'Awaiting Owner',
  };

  const respondWithPostedCommentsAndTriageRequestsInTurn = (
    respondToFirstTriageRequest: PostResponder,
    respondToLaterTriageRequests: PostResponder,
  ): PostResponder => {
    let triageRequestCount = 0;
    return respondToCommentAsPostedAndOtherRequestsWith((url, init) => {
      if (!url.endsWith('/api/triage')) {
        return respondWithOperationSucceeded(url, init);
      }
      triageRequestCount += 1;
      return triageRequestCount === 1
        ? respondToFirstTriageRequest(url, init)
        : respondToLaterTriageRequests(url, init);
    });
  };

  const findErrorToastRetryButton = (
    container: HTMLElement,
  ): Promise<HTMLElement> =>
    waitFor(() => {
      const button = container.querySelector('.console-error-toast-retry');
      expect(button).not.toBeNull();
      return button as HTMLElement;
    });

  type CommentThenSecondRequestAction = {
    actionName: string;
    startAction: (view: ReturnType<typeof render>) => Promise<void>;
    expectedCommentBody: string;
    expectedSecondRequestBody: Record<string, string>;
    expectedSecondRequestOfflinePayload: Record<string, string>;
  };

  const commentThenSecondRequestActions: CommentThenSecondRequestAction[] = [
    {
      actionName: 'OK & Close from the detail',
      startAction: async (view) => {
        await openPullRequestDetail(view);
        fireEvent.click(view.getByText('OK & Close'));
      },
      expectedCommentBody: 'ok',
      expectedSecondRequestBody: closeRequestBodyForPullRequest,
      expectedSecondRequestOfflinePayload:
        closeOfflineRequestBodyForPullRequest,
    },
    {
      actionName: 'Comment & Close from the detail',
      startAction: async (view) => {
        await openPullRequestDetail(view);
        fireEvent.change(view.getByPlaceholderText('Leave a comment…'), {
          target: { value: 'Closing after the outage.' },
        });
        fireEvent.click(view.getByText('Comment & Close'));
      },
      expectedCommentBody: 'Closing after the outage.',
      expectedSecondRequestBody: closeRequestBodyForPullRequest,
      expectedSecondRequestOfflinePayload:
        closeOfflineRequestBodyForPullRequest,
    },
    {
      actionName: 'ok & Awaiting Workspace from the detail',
      startAction: async (view) => {
        await openPullRequestDetail(view);
        fireEvent.click(
          view.getByRole('button', { name: 'ok & Awaiting Workspace' }),
        );
      },
      expectedCommentBody: 'ok',
      expectedSecondRequestBody: awaitingWorkspaceRequestBodyForPullRequest,
      expectedSecondRequestOfflinePayload:
        awaitingWorkspaceRequestBodyForPullRequest,
    },
    {
      actionName: 'Comment & Awaiting Workspace from the detail',
      startAction: async (view) => {
        await openPullRequestDetail(view);
        fireEvent.change(view.getByPlaceholderText('Leave a comment…'), {
          target: { value: 'Moving after the outage.' },
        });
        fireEvent.click(view.getByText('Comment & Awaiting Workspace'));
      },
      expectedCommentBody: 'Moving after the outage.',
      expectedSecondRequestBody: awaitingWorkspaceRequestBodyForPullRequest,
      expectedSecondRequestOfflinePayload:
        awaitingWorkspaceRequestBodyForPullRequest,
    },
    {
      actionName: 'ok & Awaiting Workspace from the list',
      startAction: async (view) => {
        const [okAndAwaitingWorkspaceButton] = await view.findAllByRole(
          'button',
          { name: 'ok & Awaiting Workspace' },
        );
        fireEvent.click(okAndAwaitingWorkspaceButton);
      },
      expectedCommentBody: 'ok',
      expectedSecondRequestBody: awaitingWorkspaceRequestBodyForPullRequest,
      expectedSecondRequestOfflinePayload:
        awaitingWorkspaceRequestBodyForPullRequest,
    },
  ];

  it.each(commentThenSecondRequestActions)(
    'retries $actionName by sending only its second request again, never the comment, when the comment was posted and the second request answered HTTP 500 online',
    async ({ startAction, expectedCommentBody, expectedSecondRequestBody }) => {
      const fetchMock = installOfflineQueueFetch(
        respondWithPostedCommentsAndTriageRequestsInTurn(
          respondWithHostRejection,
          respondWithOperationSucceeded,
        ),
      );
      const view = render(<ConsolePage />);
      await startAction(view);
      await dismissUndoToast(view.container);
      const retryButton = await findErrorToastRetryButton(view.container);
      expect(postedRequestBodies(fetchMock, '/api/comment')).toEqual([
        { pjcode: 'acme', url: pullRequestUrl, body: expectedCommentBody },
      ]);

      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(postedRequestBodies(fetchMock, '/api/triage')).toHaveLength(2);
      });
      expect(postedRequestBodies(fetchMock, '/api/comment')).toEqual([
        { pjcode: 'acme', url: pullRequestUrl, body: expectedCommentBody },
      ]);
      expect(postedRequestBodies(fetchMock, '/api/triage')).toEqual([
        expectedSecondRequestBody,
        expectedSecondRequestBody,
      ]);
      expect(readStoredOfflineQueue()).toEqual([]);
      expect(view.container.querySelector('.console-error-toast')).toBeNull();
    },
  );

  it.each(commentThenSecondRequestActions)(
    'holds only the second request of $actionName without an error toast and posts the comment only once when the comment was posted, the second request answered HTTP 500 online and its retry fails because the network is unavailable',
    async ({
      startAction,
      expectedCommentBody,
      expectedSecondRequestBody,
      expectedSecondRequestOfflinePayload,
    }) => {
      const fetchMock = installOfflineQueueFetch(
        respondWithPostedCommentsAndTriageRequestsInTurn(
          respondWithHostRejection,
          respondWithNetworkFailure,
        ),
      );
      const view = render(<ConsolePage />);
      await startAction(view);
      await dismissUndoToast(view.container);
      const retryButton = await findErrorToastRetryButton(view.container);

      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(readStoredOfflineQueue()).not.toEqual([]);
      });
      expect(readStoredOfflineQueue()).toEqual([
        expect.objectContaining({
          itemUrl: pullRequestUrl,
          apiPath: '/api/triage',
          requestBody: expectedSecondRequestOfflinePayload,
        }),
      ]);
      expect(view.container.querySelector('.console-error-toast')).toBeNull();
      expect(postedRequestBodies(fetchMock, '/api/comment')).toEqual([
        { pjcode: 'acme', url: pullRequestUrl, body: expectedCommentBody },
      ]);
      expect(postedRequestBodies(fetchMock, '/api/triage')).toEqual([
        expectedSecondRequestBody,
        expectedSecondRequestBody,
      ]);
    },
  );

  const airplaneSyncDoneStream = (): ReadableStream<Uint8Array> => {
    const snapshot = {
      capturedAt: '2026-06-19T01:00:00.000Z',
      tabs: {
        acme: Object.fromEntries(
          [
            'prs',
            'workflow-blocker',
            'failed-preparation',
            'todo-by-human',
            'stories',
          ].map((tab) => [tab, listPayload(tab)]),
        ),
      },
      items: {},
      failures: [],
    };
    const encodedDoneEvent = new TextEncoder().encode(
      `data: ${JSON.stringify({ type: 'done', snapshot })}\n\n`,
    );
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encodedDoneEvent);
        controller.close();
      },
    });
  };

  const installOfflineQueueFetchWithAirplaneModeSync = (
    respondToPost: PostResponder,
  ): jest.Mock => {
    const respondWithoutAirplaneMode = installOfflineQueueFetch(respondToPost);
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/features') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ airplaneMode: true }),
        };
      }
      if (url === '/api/airplanesync') {
        return { ok: true, status: 200, body: airplaneSyncDoneStream() };
      }
      return respondWithoutAirplaneMode(url, init);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  const installAirplaneSnapshotCacheStorage = (): void => {
    Object.defineProperty(global, 'caches', {
      writable: true,
      configurable: true,
      value: {
        open: jest.fn().mockResolvedValue({
          put: jest.fn().mockResolvedValue(undefined),
          match: jest.fn().mockResolvedValue(undefined),
          delete: jest.fn().mockResolvedValue(true),
        }),
        delete: jest.fn().mockResolvedValue(true),
      },
    });
  };

  const removeCacheStorage = (): void => {
    Object.defineProperty(global, 'caches', {
      writable: true,
      configurable: true,
      value: undefined,
    });
  };

  it.each(commentThenSecondRequestActions)(
    'holds only the second request of $actionName without sending anything or showing an airplane mode error when the comment was posted, the second request answered HTTP 500 online and airplane mode is turned on before the retry',
    async ({
      startAction,
      expectedCommentBody,
      expectedSecondRequestBody,
      expectedSecondRequestOfflinePayload,
    }) => {
      const fetchMock = installOfflineQueueFetchWithAirplaneModeSync(
        respondWithPostedCommentsAndTriageRequestsInTurn(
          respondWithHostRejection,
          respondWithOperationSucceeded,
        ),
      );
      try {
        const view = render(<ConsolePage />);
        await startAction(view);
        await dismissUndoToast(view.container);
        await findErrorToastRetryButton(view.container);
        installAirplaneSnapshotCacheStorage();
        fireEvent.click(
          await view.findByRole('button', { name: '✈ Airplane mode' }),
        );
        expect(await view.findByText('Turn off')).toBeInTheDocument();

        fireEvent.click(await findErrorToastRetryButton(view.container));

        await waitFor(() => {
          expect(readStoredOfflineQueue()).not.toEqual([]);
        });
        expect(readStoredOfflineQueue()).toEqual([
          expect.objectContaining({
            itemUrl: pullRequestUrl,
            apiPath: '/api/triage',
            requestBody: expectedSecondRequestOfflinePayload,
          }),
        ]);
        expect(postCount(fetchMock)).toBe(2);
        expect(postedRequestBodies(fetchMock, '/api/comment')).toEqual([
          { pjcode: 'acme', url: pullRequestUrl, body: expectedCommentBody },
        ]);
        expect(postedRequestBodies(fetchMock, '/api/triage')).toEqual([
          expectedSecondRequestBody,
        ]);
        expect(view.queryByText('Airplane mode')).toBeNull();
        expect(view.container.querySelector('.console-error-toast')).toBeNull();
      } finally {
        removeCacheStorage();
      }
    },
  );

  const respondWithCommentsInTurnAndOtherRequestsSucceeded = (
    respondToFirstComment: PostResponder,
    respondToLaterComments: PostResponder,
  ): PostResponder => {
    let commentRequestCount = 0;
    return (url, init) => {
      if (!url.endsWith('/api/comment')) {
        return respondWithOperationSucceeded(url, init);
      }
      commentRequestCount += 1;
      return commentRequestCount === 1
        ? respondToFirstComment(url, init)
        : respondToLaterComments(url, init);
    };
  };

  it('retries OK & Close by sending the ok comment again and then the close when the ok comment answered HTTP 500 online', async () => {
    const fetchMock = installOfflineQueueFetch(
      respondWithCommentsInTurnAndOtherRequestsSucceeded(
        respondWithHostRejection,
        respondWithPostedComment,
      ),
    );
    const view = render(<ConsolePage />);
    await openPullRequestDetail(view);
    fireEvent.click(view.getByText('OK & Close'));
    await dismissUndoToast(view.container);
    const retryButton = await findErrorToastRetryButton(view.container);
    expect(postedRequestBodies(fetchMock, '/api/triage')).toEqual([]);

    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(postedRequestBodies(fetchMock, '/api/triage')).toHaveLength(1);
    });
    expect(postedRequestBodies(fetchMock, '/api/comment')).toEqual([
      { pjcode: 'acme', url: pullRequestUrl, body: 'ok' },
      { pjcode: 'acme', url: pullRequestUrl, body: 'ok' },
    ]);
    expect(postedRequestBodies(fetchMock, '/api/triage')).toEqual([
      closeRequestBodyForPullRequest,
    ]);
    expect(readStoredOfflineQueue()).toEqual([]);
    expect(view.container.querySelector('.console-error-toast')).toBeNull();
  });

  it('holds both the ok comment and the close of OK & Close in order without an error toast when the ok comment answered HTTP 500 online and its retry fails because the network is unavailable', async () => {
    const fetchMock = installOfflineQueueFetch(
      respondWithCommentsInTurnAndOtherRequestsSucceeded(
        respondWithHostRejection,
        respondWithNetworkFailure,
      ),
    );
    const view = render(<ConsolePage />);
    await openPullRequestDetail(view);
    fireEvent.click(view.getByText('OK & Close'));
    await dismissUndoToast(view.container);
    const retryButton = await findErrorToastRetryButton(view.container);

    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(readStoredOfflineQueue()).toHaveLength(2);
    });
    expect(readStoredOfflineQueue()).toEqual([
      expect.objectContaining({
        itemUrl: pullRequestUrl,
        apiPath: '/api/comment',
        requestBody: { pjcode: 'acme', url: pullRequestUrl, body: 'ok' },
      }),
      expect.objectContaining({
        itemUrl: pullRequestUrl,
        apiPath: '/api/triage',
        requestBody: closeOfflineRequestBodyForPullRequest,
      }),
    ]);
    expect(view.container.querySelector('.console-error-toast')).toBeNull();
    expect(postedRequestBodies(fetchMock, '/api/comment')).toHaveLength(2);
    expect(postedRequestBodies(fetchMock, '/api/triage')).toEqual([]);
  });
});

describe('createIssueWithAttachments attachment submission progress', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const pjcode = 'acme';
  const nameWithOwner = 'o/r';
  const ISSUE_URL = 'https://github.com/o/r/issues/321';

  const markdownFor = (fileName: string): string =>
    `![${fileName}](https://example.com/${fileName})`;

  const makeFile = (name: string): File => {
    const file = new File(['x'], name);
    (
      file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }
    ).arrayBuffer = async () => new Uint8Array([120]).buffer;
    return file;
  };

  const buildProgress = (
    priorIssueUrl: string | null,
    priorUploaded: Array<[string, string]>,
    priorCommented: string[],
  ): AttachmentSubmissionProgress => ({
    issueUrl: priorIssueUrl,
    uploadedMarkdownByFileName: new Map(priorUploaded),
    commentedFileNames: new Set(priorCommented),
  });

  type FileAttempt = { name: string; outcome: 'success' | 'failure' };

  type ExpectedOutcome =
    | { kind: 'resolves' }
    | { kind: 'rejectsPropagated'; message: string }
    | {
        kind: 'rejectsWrapped';
        failedFileNames: string[];
        commentPostError: string | null;
      };

  type Row = {
    name: string;
    priorIssueUrl: string | null;
    priorUploaded: Array<[string, string]>;
    priorCommented: string[];
    files: FileAttempt[];
    createIssueBehavior: 'success' | 'failure';
    commentBehavior: 'success' | 'apiFailure' | 'notCalled';
    expectCreateIssueCalls: number;
    expectAttachmentCalls: number;
    expectCommentCalls: number;
    expectOutcome: ExpectedOutcome;
    expectFinalUploaded: string[];
    expectFinalCommented: string[];
    expectCommentBodyIncludes?: string[];
  };

  const rows: Row[] = [
    {
      name: 'row 1: fresh, no files -> issue created, no comment',
      priorIssueUrl: null,
      priorUploaded: [],
      priorCommented: [],
      files: [],
      createIssueBehavior: 'success',
      commentBehavior: 'notCalled',
      expectCreateIssueCalls: 1,
      expectAttachmentCalls: 0,
      expectCommentCalls: 0,
      expectOutcome: { kind: 'resolves' },
      expectFinalUploaded: [],
      expectFinalCommented: [],
    },
    {
      name: 'row 2: fresh, [A] succeeds -> issue created, comment with A posted',
      priorIssueUrl: null,
      priorUploaded: [],
      priorCommented: [],
      files: [{ name: 'A.png', outcome: 'success' }],
      createIssueBehavior: 'success',
      commentBehavior: 'success',
      expectCreateIssueCalls: 1,
      expectAttachmentCalls: 1,
      expectCommentCalls: 1,
      expectOutcome: { kind: 'resolves' },
      expectFinalUploaded: ['A.png'],
      expectFinalCommented: ['A.png'],
      expectCommentBodyIncludes: [markdownFor('A.png')],
    },
    {
      name: 'row 3: fresh, [A,B], A succeeds/B fails -> comment with A only, rejects naming B',
      priorIssueUrl: null,
      priorUploaded: [],
      priorCommented: [],
      files: [
        { name: 'A.png', outcome: 'success' },
        { name: 'B.png', outcome: 'failure' },
      ],
      createIssueBehavior: 'success',
      commentBehavior: 'success',
      expectCreateIssueCalls: 1,
      expectAttachmentCalls: 2,
      expectCommentCalls: 1,
      expectOutcome: {
        kind: 'rejectsWrapped',
        failedFileNames: ['B.png'],
        commentPostError: null,
      },
      expectFinalUploaded: ['A.png'],
      expectFinalCommented: ['A.png'],
      expectCommentBodyIncludes: [markdownFor('A.png')],
    },
    {
      name: 'row 4: fresh, [A,B], A fails but B still succeeds independently -> comment with B only, rejects naming A',
      priorIssueUrl: null,
      priorUploaded: [],
      priorCommented: [],
      files: [
        { name: 'A.png', outcome: 'failure' },
        { name: 'B.png', outcome: 'success' },
      ],
      createIssueBehavior: 'success',
      commentBehavior: 'success',
      expectCreateIssueCalls: 1,
      expectAttachmentCalls: 2,
      expectCommentCalls: 1,
      expectOutcome: {
        kind: 'rejectsWrapped',
        failedFileNames: ['A.png'],
        commentPostError: null,
      },
      expectFinalUploaded: ['B.png'],
      expectFinalCommented: ['B.png'],
      expectCommentBodyIncludes: [markdownFor('B.png')],
    },
    {
      name: 'row 5: fresh, [A,B] both fail -> no comment, rejects naming both',
      priorIssueUrl: null,
      priorUploaded: [],
      priorCommented: [],
      files: [
        { name: 'A.png', outcome: 'failure' },
        { name: 'B.png', outcome: 'failure' },
      ],
      createIssueBehavior: 'success',
      commentBehavior: 'notCalled',
      expectCreateIssueCalls: 1,
      expectAttachmentCalls: 2,
      expectCommentCalls: 0,
      expectOutcome: {
        kind: 'rejectsWrapped',
        failedFileNames: ['A.png', 'B.png'],
        commentPostError: null,
      },
      expectFinalUploaded: [],
      expectFinalCommented: [],
    },
    {
      name: 'row 6: fresh, [A,B] both succeed but the comment-post call itself fails -> rejects distinctly, keeps both uploads',
      priorIssueUrl: null,
      priorUploaded: [],
      priorCommented: [],
      files: [
        { name: 'A.png', outcome: 'success' },
        { name: 'B.png', outcome: 'success' },
      ],
      createIssueBehavior: 'success',
      commentBehavior: 'apiFailure',
      expectCreateIssueCalls: 1,
      expectAttachmentCalls: 2,
      expectCommentCalls: 1,
      expectOutcome: {
        kind: 'rejectsWrapped',
        failedFileNames: [],
        commentPostError: 'comment post failed',
      },
      expectFinalUploaded: ['A.png', 'B.png'],
      expectFinalCommented: [],
      expectCommentBodyIncludes: [markdownFor('A.png'), markdownFor('B.png')],
    },
    {
      name: 'row 7: existing issue, B still pending -> no new issue, B uploads and comment succeeds',
      priorIssueUrl: ISSUE_URL,
      priorUploaded: [],
      priorCommented: [],
      files: [{ name: 'B.png', outcome: 'success' }],
      createIssueBehavior: 'failure',
      commentBehavior: 'success',
      expectCreateIssueCalls: 0,
      expectAttachmentCalls: 1,
      expectCommentCalls: 1,
      expectOutcome: { kind: 'resolves' },
      expectFinalUploaded: ['B.png'],
      expectFinalCommented: ['B.png'],
      expectCommentBodyIncludes: [markdownFor('B.png')],
    },
    {
      name: 'row 8: existing issue, B still pending, B fails again -> no duplicate issue, rejects naming B with the same issue url',
      priorIssueUrl: ISSUE_URL,
      priorUploaded: [],
      priorCommented: [],
      files: [{ name: 'B.png', outcome: 'failure' }],
      createIssueBehavior: 'failure',
      commentBehavior: 'notCalled',
      expectCreateIssueCalls: 0,
      expectAttachmentCalls: 1,
      expectCommentCalls: 0,
      expectOutcome: {
        kind: 'rejectsWrapped',
        failedFileNames: ['B.png'],
        commentPostError: null,
      },
      expectFinalUploaded: [],
      expectFinalCommented: [],
    },
    {
      name: 'row 9: existing issue, A and B already uploaded, only the comment is pending -> retried comment succeeds without any re-upload',
      priorIssueUrl: ISSUE_URL,
      priorUploaded: [
        ['A.png', markdownFor('A.png')],
        ['B.png', markdownFor('B.png')],
      ],
      priorCommented: [],
      files: [],
      createIssueBehavior: 'failure',
      commentBehavior: 'success',
      expectCreateIssueCalls: 0,
      expectAttachmentCalls: 0,
      expectCommentCalls: 1,
      expectOutcome: { kind: 'resolves' },
      expectFinalUploaded: ['A.png', 'B.png'],
      expectFinalCommented: ['A.png', 'B.png'],
      expectCommentBodyIncludes: [markdownFor('A.png'), markdownFor('B.png')],
    },
    {
      name: 'row 10: fresh, issue creation itself fails -> no issue created at all, nothing else runs',
      priorIssueUrl: null,
      priorUploaded: [],
      priorCommented: [],
      files: [{ name: 'A.png', outcome: 'success' }],
      createIssueBehavior: 'failure',
      commentBehavior: 'notCalled',
      expectCreateIssueCalls: 1,
      expectAttachmentCalls: 0,
      expectCommentCalls: 0,
      expectOutcome: {
        kind: 'rejectsPropagated',
        message: 'Failed to create the task. Please try again.',
      },
      expectFinalUploaded: [],
      expectFinalCommented: [],
    },
  ];

  it.each(rows)('$name', async (row) => {
    const createIssueSpy = jest.spyOn(consoleApi, 'postConsoleCreateIssue');
    if (row.createIssueBehavior === 'success') {
      createIssueSpy.mockResolvedValue(ISSUE_URL);
    } else {
      createIssueSpy.mockRejectedValue(new Error('create issue failed'));
    }

    const attachmentSpy = jest.spyOn(consoleApi, 'postConsoleAttachment');
    attachmentSpy.mockImplementation(async (request) => {
      const attempt = row.files.find((f) => f.name === request.fileName);
      if (attempt?.outcome === 'failure') {
        throw new Error(`${request.fileName} upload failed`);
      }
      return markdownFor(request.fileName);
    });

    const commentSpy = jest.spyOn(consoleApi, 'postConsoleComment');
    if (row.commentBehavior === 'success') {
      commentSpy.mockImplementation(async (request) => ({
        posted: true,
        comment: {
          id: 1,
          author: 'bot',
          body: request.body,
          createdAt: '2026-06-19T00:00:00.000Z',
        },
      }));
    } else if (row.commentBehavior === 'apiFailure') {
      commentSpy.mockResolvedValue({
        posted: false,
        error: 'comment post failed',
        rateLimitResetAt: null,
      });
    } else {
      commentSpy.mockImplementation(async () => {
        throw new Error('postConsoleComment must not be called for this row');
      });
    }

    const progress =
      row.priorIssueUrl === null &&
      row.priorUploaded.length === 0 &&
      row.priorCommented.length === 0
        ? createEmptyAttachmentSubmissionProgress()
        : buildProgress(
            row.priorIssueUrl,
            row.priorUploaded,
            row.priorCommented,
          );

    const params = {
      storyName: null,
      agentOptionId: null,
      title: 'Task with attachments',
      body: null,
      files: row.files.map((f) => makeFile(f.name)),
    };

    let thrown: unknown = null;
    let resolved = false;
    try {
      await createIssueWithAttachments(pjcode, nameWithOwner, params, progress);
      resolved = true;
    } catch (error) {
      thrown = error;
    }

    if (row.expectOutcome.kind === 'resolves') {
      expect(resolved).toBe(true);
    } else if (row.expectOutcome.kind === 'rejectsPropagated') {
      expect(resolved).toBe(false);
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe(row.expectOutcome.message);
    } else {
      expect(resolved).toBe(false);
      expect(thrown).toBeInstanceOf(Error);
      expect(progress.issueUrl).not.toBeNull();
      expect((thrown as Error).message).toBe(
        buildAttachmentSubmissionFailureMessage(
          progress.issueUrl as string,
          row.expectOutcome.failedFileNames,
          row.expectOutcome.commentPostError,
        ),
      );
    }

    expect(createIssueSpy).toHaveBeenCalledTimes(row.expectCreateIssueCalls);
    expect(attachmentSpy).toHaveBeenCalledTimes(row.expectAttachmentCalls);
    expect(commentSpy).toHaveBeenCalledTimes(row.expectCommentCalls);

    expect(
      Array.from(progress.uploadedMarkdownByFileName.keys()).sort(),
    ).toEqual([...row.expectFinalUploaded].sort());
    expect(Array.from(progress.commentedFileNames).sort()).toEqual(
      [...row.expectFinalCommented].sort(),
    );

    if (row.expectCommentBodyIncludes !== undefined) {
      const call = commentSpy.mock.calls[0][0];
      for (const snippet of row.expectCommentBodyIncludes) {
        expect(call.body).toContain(snippet);
      }
    }

    if (row.priorIssueUrl !== null) {
      expect(progress.issueUrl).toBe(row.priorIssueUrl);
    } else if (row.createIssueBehavior === 'success') {
      expect(progress.issueUrl).toBe(ISSUE_URL);
    } else {
      expect(progress.issueUrl).toBeNull();
    }
  });

  it('resumes across two calls with the same progress object: a partial file failure, then a retry of only the failed file succeeds (rows 3 -> 7)', async () => {
    const progress = createEmptyAttachmentSubmissionProgress();
    const createIssueSpy = jest
      .spyOn(consoleApi, 'postConsoleCreateIssue')
      .mockResolvedValue(ISSUE_URL);

    let bUploadAttempts = 0;
    const attachmentSpy = jest
      .spyOn(consoleApi, 'postConsoleAttachment')
      .mockImplementation(async (request) => {
        if (request.fileName === 'B.png') {
          bUploadAttempts += 1;
          if (bUploadAttempts === 1) {
            throw new Error('B upload failed');
          }
        }
        return markdownFor(request.fileName);
      });

    const commentSpy = jest
      .spyOn(consoleApi, 'postConsoleComment')
      .mockImplementation(async (request) => ({
        posted: true,
        comment: {
          id: 1,
          author: 'bot',
          body: request.body,
          createdAt: '2026-06-19T00:00:00.000Z',
        },
      }));

    const firstParams = {
      storyName: null,
      agentOptionId: null,
      title: 'Task with attachments',
      body: null,
      files: [makeFile('A.png'), makeFile('B.png')],
    };

    let firstError: unknown = null;
    try {
      await createIssueWithAttachments(
        pjcode,
        nameWithOwner,
        firstParams,
        progress,
      );
    } catch (error) {
      firstError = error;
    }
    expect(firstError).toBeInstanceOf(Error);
    expect((firstError as Error).message).toBe(
      buildAttachmentSubmissionFailureMessage(ISSUE_URL, ['B.png'], null),
    );
    expect(createIssueSpy).toHaveBeenCalledTimes(1);
    expect(progress.issueUrl).toBe(ISSUE_URL);
    expect(Array.from(progress.uploadedMarkdownByFileName.keys())).toEqual([
      'A.png',
    ]);
    expect(Array.from(progress.commentedFileNames)).toEqual(['A.png']);

    const secondParams = {
      storyName: null,
      agentOptionId: null,
      title: 'Task with attachments',
      body: null,
      files: [makeFile('B.png')],
    };

    let secondResolved = false;
    await createIssueWithAttachments(
      pjcode,
      nameWithOwner,
      secondParams,
      progress,
    ).then(() => {
      secondResolved = true;
    });
    expect(secondResolved).toBe(true);

    expect(createIssueSpy).toHaveBeenCalledTimes(1);
    const aAttachmentCalls = attachmentSpy.mock.calls.filter(
      ([request]) => request.fileName === 'A.png',
    );
    expect(aAttachmentCalls).toHaveLength(1);
    expect(
      Array.from(progress.uploadedMarkdownByFileName.keys()).sort(),
    ).toEqual(['A.png', 'B.png']);
    expect(Array.from(progress.commentedFileNames).sort()).toEqual([
      'A.png',
      'B.png',
    ]);
    expect(commentSpy).toHaveBeenCalledTimes(2);
    const secondCommentCall = commentSpy.mock.calls[1][0];
    expect(secondCommentCall.body).toContain(markdownFor('B.png'));
    expect(secondCommentCall.body).not.toContain(markdownFor('A.png'));
  });

  it('resumes across two calls with the same progress object: successful uploads with a failed comment post, then a retry resends only the comment using the retained links (rows 6 -> 9)', async () => {
    const progress = createEmptyAttachmentSubmissionProgress();
    const createIssueSpy = jest
      .spyOn(consoleApi, 'postConsoleCreateIssue')
      .mockResolvedValue(ISSUE_URL);

    const attachmentSpy = jest
      .spyOn(consoleApi, 'postConsoleAttachment')
      .mockImplementation(async (request) => markdownFor(request.fileName));

    let commentAttempts = 0;
    const commentSpy = jest
      .spyOn(consoleApi, 'postConsoleComment')
      .mockImplementation(async (request) => {
        commentAttempts += 1;
        if (commentAttempts === 1) {
          return {
            posted: false,
            error: 'comment post failed',
            rateLimitResetAt: null,
          };
        }
        return {
          posted: true,
          comment: {
            id: 2,
            author: 'bot',
            body: request.body,
            createdAt: '2026-06-19T00:00:00.000Z',
          },
        };
      });

    const firstParams = {
      storyName: null,
      agentOptionId: null,
      title: 'Task with attachments',
      body: null,
      files: [makeFile('A.png'), makeFile('B.png')],
    };

    let firstError: unknown = null;
    try {
      await createIssueWithAttachments(
        pjcode,
        nameWithOwner,
        firstParams,
        progress,
      );
    } catch (error) {
      firstError = error;
    }
    expect(firstError).toBeInstanceOf(Error);
    expect((firstError as Error).message).toBe(
      buildAttachmentSubmissionFailureMessage(
        ISSUE_URL,
        [],
        'comment post failed',
      ),
    );
    expect((firstError as Error).message).not.toMatch(
      /file\(s\) failed to upload/,
    );
    expect(createIssueSpy).toHaveBeenCalledTimes(1);
    expect(attachmentSpy).toHaveBeenCalledTimes(2);
    expect(
      Array.from(progress.uploadedMarkdownByFileName.keys()).sort(),
    ).toEqual(['A.png', 'B.png']);
    expect(Array.from(progress.commentedFileNames)).toEqual([]);

    const secondParams = {
      storyName: null,
      agentOptionId: null,
      title: 'Task with attachments',
      body: null,
      files: [],
    };

    let secondResolved = false;
    await createIssueWithAttachments(
      pjcode,
      nameWithOwner,
      secondParams,
      progress,
    ).then(() => {
      secondResolved = true;
    });
    expect(secondResolved).toBe(true);

    expect(createIssueSpy).toHaveBeenCalledTimes(1);
    expect(attachmentSpy).toHaveBeenCalledTimes(2);
    expect(commentSpy).toHaveBeenCalledTimes(2);
    const secondCommentCall = commentSpy.mock.calls[1][0];
    expect(secondCommentCall.body).toContain(markdownFor('A.png'));
    expect(secondCommentCall.body).toContain(markdownFor('B.png'));
    expect(Array.from(progress.commentedFileNames).sort()).toEqual([
      'A.png',
      'B.png',
    ]);
  });

  it('wraps a thrown postConsoleComment rejection into a clean message while keeping already-uploaded file links', async () => {
    const progress = createEmptyAttachmentSubmissionProgress();
    const createIssueSpy = jest
      .spyOn(consoleApi, 'postConsoleCreateIssue')
      .mockResolvedValue(ISSUE_URL);

    const attachmentSpy = jest
      .spyOn(consoleApi, 'postConsoleAttachment')
      .mockImplementation(async (request) => markdownFor(request.fileName));

    const commentSpy = jest
      .spyOn(consoleApi, 'postConsoleComment')
      .mockRejectedValue(new Error('network exploded'));

    const params = {
      storyName: null,
      agentOptionId: null,
      title: 'Task with attachments',
      body: null,
      files: [makeFile('A.png'), makeFile('B.png')],
    };

    let thrown: unknown = null;
    try {
      await createIssueWithAttachments(pjcode, nameWithOwner, params, progress);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(
      buildAttachmentSubmissionFailureMessage(
        ISSUE_URL,
        [],
        'posting the summary comment failed unexpectedly',
      ),
    );
    expect((thrown as Error).message).not.toContain('network exploded');
    expect(createIssueSpy).toHaveBeenCalledTimes(1);
    expect(attachmentSpy).toHaveBeenCalledTimes(2);
    expect(commentSpy).toHaveBeenCalledTimes(1);
    expect(
      Array.from(progress.uploadedMarkdownByFileName.keys()).sort(),
    ).toEqual(['A.png', 'B.png']);
    expect(Array.from(progress.commentedFileNames)).toEqual([]);
  });
});

describe('attachmentSubmissionParamsChanged', () => {
  const baseParams: IssueCreateParams = {
    storyName: 'TDPM Console port',
    agentOptionId: 'ag1',
    title: 'Original title',
    body: 'Original body',
    files: [],
  };

  const makeFile = (name: string): File => new File(['x'], name);

  type Row = {
    name: string;
    previous: IssueCreateParams;
    current: IssueCreateParams;
    expected: boolean;
  };

  const rows: Row[] = [
    {
      name: 'returns false when every compared field is identical and files are also identical',
      previous: baseParams,
      current: { ...baseParams },
      expected: false,
    },
    {
      name: 'returns false when only files differ (files are excluded from the comparison)',
      previous: { ...baseParams, files: [] },
      current: { ...baseParams, files: [makeFile('A.png')] },
      expected: false,
    },
    {
      name: 'returns true when title differs (all else same)',
      previous: baseParams,
      current: { ...baseParams, title: 'Edited title' },
      expected: true,
    },
    {
      name: 'returns true when body differs (all else same)',
      previous: baseParams,
      current: { ...baseParams, body: 'Edited body' },
      expected: true,
    },
    {
      name: 'returns true when storyName differs (all else same)',
      previous: baseParams,
      current: { ...baseParams, storyName: 'Other story' },
      expected: true,
    },
    {
      name: 'returns true when agentOptionId differs (all else same)',
      previous: baseParams,
      current: { ...baseParams, agentOptionId: 'ag2' },
      expected: true,
    },
  ];

  it.each(rows)('$name', ({ previous, current, expected }) => {
    expect(attachmentSubmissionParamsChanged(previous, current)).toBe(expected);
  });
});

describe('ConsolePage comment elapsed-time label live update', () => {
  it('switches a comment elapsed-time label from "just now" to "1 minute ago" once its age crosses the 45-second wording boundary during the live interval tick (SC-006)', async () => {
    jest.useFakeTimers();
    try {
      localStorage.clear();
      window.history.replaceState({}, '', '/projects/acme/prs?k=token');
      const commentCreatedAt = new Date(Date.now() - 10 * 1000).toISOString();
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
        if (url.startsWith('/api/comments')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              comments: [
                {
                  id: 1,
                  author: 'reviewer',
                  body: 'Looks good.',
                  createdAt: commentCreatedAt,
                },
              ],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ body: '# body' }),
        };
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { getByText, findByText, container } = render(<ConsolePage />);
      await waitFor(() => {
        expect(getByText('Add serveConsole subcommand')).toBeInTheDocument();
      });
      fireEvent.click(getByText('Add serveConsole subcommand'));
      expect(await findByText('Approve & Merge')).toBeInTheDocument();

      await waitFor(() => {
        expect(
          container.querySelector('.console-comment-time')?.textContent,
        ).toBe('just now');
      });

      const commentTimeLabel = (): string | null | undefined =>
        container.querySelector('.console-comment-time')?.textContent;

      const liveRefreshIntervalTickDurationMs = 1000;
      const tickCountReachingOneSecondBeforeFortyFiveSecondBoundary = 34;
      for (
        let tick = 0;
        tick < tickCountReachingOneSecondBeforeFortyFiveSecondBoundary;
        tick += 1
      ) {
        act(() => {
          jest.advanceTimersByTime(liveRefreshIntervalTickDurationMs);
        });
      }
      expect(commentTimeLabel()).toBe('just now');

      const tickCountWithinTwoSecondLatencyBoundAfterBoundaryIsCrossed = 2;
      for (
        let tick = 0;
        tick < tickCountWithinTwoSecondLatencyBoundAfterBoundaryIsCrossed;
        tick += 1
      ) {
        act(() => {
          jest.advanceTimersByTime(liveRefreshIntervalTickDurationMs);
        });
      }
      expect(commentTimeLabel()).toBe('1 minute ago');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ConsolePage operation bar status buttons', () => {
  const taskTitle = 'Task opened to read the operation bar status buttons';
  const inTmuxByHumanName = 'In Tmux by human';
  const todoByHumanName = 'Todo by human';
  const awaitingWorkspaceName = 'Awaiting Workspace';
  const unreadName = 'Unread';
  const allStatusButtonNames = [
    inTmuxByHumanName,
    todoByHumanName,
    awaitingWorkspaceName,
  ];

  const statusOptionsNamed = (names: string[]) =>
    names.map((name, index) => ({
      id: `operation-bar-status-${index}`,
      name,
      color: 'BLUE',
    }));

  const taskItem = (status: string) => ({
    number: 3490,
    title: taskTitle,
    url: 'https://github.com/o/r/issues/3490',
    repo: 'o/r',
    nameWithOwner: 'o/r',
    projectItemId: 'PVTI_OPERATION_BAR',
    itemId: 'PVTI_OPERATION_BAR',
    isPr: false,
    relatedOpenPullRequestUrls: [],
    story: 'TDPM Console port',
    status,
    agent: null,
    nextActionDate: null,
    nextActionHour: null,
    dependedIssueUrls: [],
    labels: [],
    createdAt: '2026-06-17T00:00:00.000Z',
  });

  const installFetchWithActiveTabPayload = (
    activeTab: string,
    activeTabPayload: object,
  ): void => {
    global.fetch = jest.fn(async (url: string) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const requestedTab = listMatch[1];
        return {
          ok: true,
          status: 200,
          json: async () =>
            requestedTab === activeTab
              ? activeTabPayload
              : {
                  ...listPayload(requestedTab),
                  statusOptions: statusOptionsNamed(allStatusButtonNames),
                },
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      if (url.startsWith('/api/projectreadmeconfig')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ maximumPreparingIssuesCount: 3 }),
        };
      }
      if (url.startsWith('/api/issuetitle')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            state: 'open',
            merged: false,
            isPullRequest: false,
            title: taskTitle,
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the In Tmux by human, Todo by human and Awaiting Workspace buttons in the operation bar of a non-closed task opened from a story of the stories tab', async () => {
    window.history.replaceState({}, '', '/projects/acme/stories?k=token');
    installFetchWithActiveTabPayload('stories', {
      ...listPayload('stories'),
      statusOptions: statusOptionsNamed(allStatusButtonNames),
      stories: [
        {
          storyName: 'TDPM Console port',
          storyOptionId: 'st1',
          color: 'BLUE',
          description: '',
          openItemCount: 1,
          storyViewUrl: null,
          items: [taskItem(todoByHumanName)],
        },
      ],
    });

    const { findByRole } = render(<ConsolePage />);
    fireEvent.click(await findByRole('button', { name: 'Show tasks' }));
    fireEvent.click(await findByRole('button', { name: taskTitle }));

    expect(
      await findByRole('button', { name: inTmuxByHumanName }),
    ).toBeInTheDocument();
    expect(
      await findByRole('button', { name: todoByHumanName }),
    ).toBeInTheDocument();
    expect(
      await findByRole('button', { name: awaitingWorkspaceName }),
    ).toBeInTheDocument();
  });

  type OperationBarStatusButtonCase = {
    tab: string;
    taskStatus: string;
    statusOptionNames: string[];
    expectedButtonNames: string[];
    absentButtonNames: string[];
  };

  const operationBarStatusButtonCases: OperationBarStatusButtonCase[] = [
    {
      tab: 'workflow-blocker',
      taskStatus: awaitingWorkspaceName,
      statusOptionNames: [unreadName, ...allStatusButtonNames],
      expectedButtonNames: allStatusButtonNames,
      absentButtonNames: [unreadName],
    },
    {
      tab: 'prs',
      taskStatus: 'Awaiting Owner',
      statusOptionNames: [unreadName, ...allStatusButtonNames],
      expectedButtonNames: allStatusButtonNames,
      absentButtonNames: [unreadName],
    },
    {
      tab: 'failed-preparation',
      taskStatus: 'Failed Preparation',
      statusOptionNames: [unreadName, todoByHumanName, awaitingWorkspaceName],
      expectedButtonNames: [todoByHumanName, awaitingWorkspaceName],
      absentButtonNames: [inTmuxByHumanName, unreadName],
    },
    {
      tab: 'todo-by-human',
      taskStatus: todoByHumanName,
      statusOptionNames: [unreadName, ...allStatusButtonNames],
      expectedButtonNames: allStatusButtonNames,
      absentButtonNames: [unreadName],
    },
    {
      tab: 'queued',
      taskStatus: awaitingWorkspaceName,
      statusOptionNames: [unreadName, ...allStatusButtonNames],
      expectedButtonNames: allStatusButtonNames,
      absentButtonNames: [unreadName],
    },
  ];

  it.each(operationBarStatusButtonCases)(
    'renders exactly the status buttons of the $tab tab in the operation bar of a non-closed task opened from that tab',
    async ({
      tab,
      taskStatus,
      statusOptionNames,
      expectedButtonNames,
      absentButtonNames,
    }) => {
      window.history.replaceState({}, '', `/projects/acme/${tab}?k=token`);
      installFetchWithActiveTabPayload(tab, {
        ...listPayload(tab),
        statusOptions: statusOptionsNamed(statusOptionNames),
        items: [taskItem(taskStatus)],
      });

      const { findByRole, queryByRole } = render(<ConsolePage />);
      fireEvent.click(
        await findByRole('button', { name: new RegExp(taskTitle) }),
      );

      for (const expectedButtonName of expectedButtonNames) {
        expect(
          await findByRole('button', { name: expectedButtonName }),
        ).toBeInTheDocument();
      }
      for (const absentButtonName of absentButtonNames) {
        expect(queryByRole('button', { name: absentButtonName })).toBeNull();
      }
    },
  );
});

describe('ConsolePage Set Depended Issue submission and Undo return to the submitted task', () => {
  type ScenarioTabName =
    'todo-by-human' | 'prs' | 'failed-preparation' | 'queued';

  type ScenarioTask = {
    number: number;
    title: string;
    status: string;
  };

  type ScenarioState = {
    tabTasks: Partial<Record<ScenarioTabName, ScenarioTask[]>>;
    generatedAt: string;
    writeOutcome: 'succeeds' | 'rejects without an HTTP response';
  };

  type ScenarioView = ReturnType<typeof render>;

  const DEPENDED_ISSUE_URL = 'https://github.com/o/dependency/issues/77';
  const INITIAL_SNAPSHOT_GENERATED_AT = '2026-06-19T00:00:00.000Z';
  const SUBMISSION_PRESS_TIME = '2026-06-19T00:00:10.000Z';
  const UNDO_WINDOW_CEILING_MS = 1000;
  const PANEL_RETURN_BUDGET_MS = 200;

  const FIRST_AWAITING_OWNER_TASK: ScenarioTask = {
    number: 101,
    title: 'Prepare the rollout checklist',
    status: 'Awaiting Owner',
  };
  const SECOND_AWAITING_OWNER_TASK: ScenarioTask = {
    number: 102,
    title: 'Review the migration plan',
    status: 'Awaiting Owner',
  };
  const THIRD_AWAITING_OWNER_TASK: ScenarioTask = {
    number: 103,
    title: 'Confirm the release window',
    status: 'Awaiting Owner',
  };
  const QUEUED_TASK: ScenarioTask = {
    number: 201,
    title: 'Archive the legacy dashboards',
    status: 'Queued',
  };
  const TODO_BY_HUMAN_TASK: ScenarioTask = {
    number: 301,
    title: 'Rotate the signing key',
    status: 'Todo by human',
  };
  const FAILED_PREPARATION_TASK: ScenarioTask = {
    number: 401,
    title: 'Restore the failed preparation',
    status: 'Failed Preparation',
  };

  const projectItemIdOf = (task: ScenarioTask): string => `PVTI_${task.number}`;

  const panelLabelOf = (task: ScenarioTask): string => `#${task.number}`;

  const buildScenarioItem = (task: ScenarioTask) => ({
    number: task.number,
    title: task.title,
    url: `https://github.com/o/r/issues/${task.number}`,
    repo: 'o/r',
    nameWithOwner: 'o/r',
    projectItemId: projectItemIdOf(task),
    itemId: projectItemIdOf(task),
    isPr: false,
    relatedOpenPullRequestUrls: [],
    story: 'TDPM Console port',
    status: task.status,
    agent: null,
    nextActionDate: null,
    nextActionHour: null,
    dependedIssueUrls: [],
    labels: [],
    createdAt: new Date(Date.UTC(2026, 5, 17, 0, 0, task.number)).toISOString(),
  });

  const buildScenarioTabPayload = (
    tasks: ScenarioTask[],
    generatedAt: string,
  ) => ({
    pjcode: 'acme',
    generatedAt,
    statusOptions: [{ id: 's1', name: 'Awaiting Workspace', color: 'BLUE' }],
    storyOptions: [{ id: 'st1', name: 'TDPM Console port', color: 'BLUE' }],
    storyColors: { 'TDPM Console port': { color: 'BLUE' } },
    items: tasks.map(buildScenarioItem),
  });

  const buildScenario = (
    tabTasks: ScenarioState['tabTasks'],
  ): ScenarioState => ({
    tabTasks,
    generatedAt: INITIAL_SNAPSHOT_GENERATED_AT,
    writeOutcome: 'succeeds',
  });

  const installScenarioFetch = (scenario: ScenarioState): void => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const listMatch = url.match(/\/projects\/[^/]+\/([^/]+)\/list\.json/);
      if (listMatch !== null) {
        const tasks = scenario.tabTasks[listMatch[1] as ScenarioTabName] ?? [];
        return {
          ok: true,
          status: 200,
          json: async () =>
            buildScenarioTabPayload(tasks, scenario.generatedAt),
        };
      }
      if (url === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pjcodes: ['acme'] }),
        };
      }
      if (init?.method === 'POST') {
        if (scenario.writeOutcome === 'rejects without an HTTP response') {
          throw new TypeError('Failed to fetch');
        }
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ body: '# body' }) };
    }) as unknown as typeof fetch;
  };

  const renderScenario = (
    scenario: ScenarioState,
    activeTabPathSegment: string = 'prs',
  ): ScenarioView => {
    window.history.replaceState(
      {},
      '',
      `/projects/acme/${activeTabPathSegment}?k=token`,
    );
    installScenarioFetch(scenario);
    return render(<ConsolePage />);
  };

  const postedRequestPaths = (): string[] =>
    (global.fetch as jest.Mock).mock.calls
      .filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      )
      .map(([url]) => String(url));

  const detailPanelTaskLabel = (container: HTMLElement): string | null => {
    if (container.querySelector('.console-detail-screen') === null) {
      return null;
    }
    return (
      container.querySelector('.console-detail-number')?.textContent ?? null
    );
  };

  const detailStatusBadgeText = (container: HTMLElement): string | null =>
    container.querySelector('.console-detail-status-chip')?.textContent ?? null;

  const activeTabLabel = (): string | null =>
    tabBar().querySelector(
      'a.console-tab[aria-current="page"] .console-tab-label',
    )?.textContent ?? null;

  const tabBadgeCount = (label: string): string | null =>
    within(tabBar())
      .queryByText(label)
      ?.closest('a')
      ?.querySelector('.console-tab-badge')?.textContent ?? null;

  const offlinePanelHeaderText = (container: HTMLElement): string | null =>
    container.querySelector('.console-offline-panel-header')?.textContent ??
    null;

  const readStoredOfflineApiPaths = (): string[] =>
    (
      JSON.parse(
        localStorage.getItem('console-offline-action-queue') ?? '[]',
      ) as { apiPath: string }[]
    ).map((held) => held.apiPath);

  const openTaskFromList = async (
    view: ScenarioView,
    task: ScenarioTask,
  ): Promise<void> => {
    await waitFor(() => {
      expect(view.getByText(task.title)).toBeInTheDocument();
    });
    fireEvent.click(view.getByText(task.title));
    await waitFor(() => {
      expect(detailPanelTaskLabel(view.container)).toBe(panelLabelOf(task));
    });
  };

  const submitDependedIssueUrl = async (view: ScenarioView): Promise<void> => {
    fireEvent.click(view.getByTitle('Rare actions'));
    fireEvent.change(view.getByPlaceholderText('Depended issue URL'), {
      target: { value: DEPENDED_ISSUE_URL },
    });
    await act(async () => {
      fireEvent.click(view.getByText('Set Depended Issue'));
    });
  };

  const submitAwaitingWorkspaceFromStatusChooser = async (
    view: ScenarioView,
  ): Promise<void> => {
    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Awaiting Workspace' }));
    });
  };

  const pressUndo = (view: ScenarioView): void => {
    fireEvent.click(view.getByRole('button', { name: 'Undo' }));
  };

  const advanceFakeTimersAndFlushPromises = async (
    elapsedMs: number,
  ): Promise<void> => {
    await act(async () => {
      jest.advanceTimersByTime(elapsedMs);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  const elapsedMsFromPressUntilPanelShowsTask = async (
    container: HTMLElement,
    press: () => void,
    taskLabel: string,
  ): Promise<number> => {
    const pressedAt = performance.now();
    press();
    try {
      const shownAt = await waitFor(
        () => {
          expect(detailPanelTaskLabel(container)).toBe(taskLabel);
          return performance.now();
        },
        { timeout: UNDO_WINDOW_CEILING_MS },
      );
      return shownAt - pressedAt;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  };

  const installAirplaneEnvironment = (tasks: ScenarioTask[]): void => {
    localStorage.setItem('tdpm_airplane_mode_on', '1');
    const airplaneSnapshot = {
      capturedAt: INITIAL_SNAPSHOT_GENERATED_AT,
      tabs: {
        acme: {
          prs: {
            items: tasks.map(buildScenarioItem),
            generatedAt: INITIAL_SNAPSHOT_GENERATED_AT,
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
        },
      },
      items: {},
      failures: [],
    };
    const mockCache = {
      put: jest.fn(),
      match: jest.fn().mockResolvedValue(
        new Response(JSON.stringify(airplaneSnapshot), {
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
  };

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
  });

  afterEach(() => {
    Object.defineProperty(global, 'caches', {
      writable: true,
      configurable: true,
      value: undefined,
    });
  });

  it('Undo of a Set Depended Issue submission returns the Awaiting Owner tab with the submitted task in the panel after the submission moved the owner to the Queued tab', async () => {
    const view = renderScenario(
      buildScenario({
        prs: [FIRST_AWAITING_OWNER_TASK],
        queued: [QUEUED_TASK],
      }),
    );
    await openTaskFromList(view, FIRST_AWAITING_OWNER_TASK);

    await submitDependedIssueUrl(view);

    await waitFor(() => {
      expect(activeTabLabel()).toBe('Queued');
    });
    expect(view.container.querySelector('.console-detail-screen')).toBeNull();

    pressUndo(view);

    await waitFor(() => {
      expect(activeTabLabel()).toBe('Awaiting Owner');
      expect(detailPanelTaskLabel(view.container)).toBe(
        panelLabelOf(FIRST_AWAITING_OWNER_TASK),
      );
    });
  });

  it('Undo of a Status chooser action keeps the next task in the panel and restores the Awaiting Owner count', async () => {
    const view = renderScenario(
      buildScenario({
        prs: [FIRST_AWAITING_OWNER_TASK, SECOND_AWAITING_OWNER_TASK],
      }),
    );
    await openTaskFromList(view, FIRST_AWAITING_OWNER_TASK);

    await submitAwaitingWorkspaceFromStatusChooser(view);

    await waitFor(() => {
      expect(detailPanelTaskLabel(view.container)).toBe(
        panelLabelOf(SECOND_AWAITING_OWNER_TASK),
      );
    });
    expect(tabBadgeCount('Awaiting Owner')).toBe('1');

    pressUndo(view);

    await waitFor(() => {
      expect(tabBadgeCount('Awaiting Owner')).toBe('2');
    });
    expect(activeTabLabel()).toBe('Awaiting Owner');
    expect(detailPanelTaskLabel(view.container)).toBe(
      panelLabelOf(SECOND_AWAITING_OWNER_TASK),
    );
  });

  it('Undo of a Set Depended Issue submission shows the submitted task in the panel within 200 ms of the press', async () => {
    const view = renderScenario(
      buildScenario({
        prs: [FIRST_AWAITING_OWNER_TASK, SECOND_AWAITING_OWNER_TASK],
      }),
    );
    await openTaskFromList(view, FIRST_AWAITING_OWNER_TASK);
    await submitDependedIssueUrl(view);
    await waitFor(() => {
      expect(detailPanelTaskLabel(view.container)).toBe(
        panelLabelOf(SECOND_AWAITING_OWNER_TASK),
      );
    });

    const elapsedMs = await elapsedMsFromPressUntilPanelShowsTask(
      view.container,
      () => pressUndo(view),
      panelLabelOf(FIRST_AWAITING_OWNER_TASK),
    );

    expect(elapsedMs).toBeLessThan(PANEL_RETURN_BUDGET_MS);
  });

  type TabAtSubmissionCase = {
    name: string;
    tabPathSegment: string;
    tabLabel: string;
    tabTasks: ScenarioState['tabTasks'];
    submittedTask: ScenarioTask;
    tabLabelAfterSubmission: string;
  };

  const tabAtSubmissionCases: TabAtSubmissionCase[] = [
    {
      name: 'the Todo by human tab with the Awaiting Owner tab to its right',
      tabPathSegment: 'todo-by-human',
      tabLabel: 'Todo by human',
      tabTasks: {
        'todo-by-human': [TODO_BY_HUMAN_TASK],
        prs: [FIRST_AWAITING_OWNER_TASK],
      },
      submittedTask: TODO_BY_HUMAN_TASK,
      tabLabelAfterSubmission: 'Awaiting Owner',
    },
    {
      name: 'the Failed Preparation tab with the Queued tab to its right',
      tabPathSegment: 'failed-preparation',
      tabLabel: 'Failed Preparation',
      tabTasks: {
        'failed-preparation': [FAILED_PREPARATION_TASK],
        queued: [QUEUED_TASK],
      },
      submittedTask: FAILED_PREPARATION_TASK,
      tabLabelAfterSubmission: 'Queued',
    },
    {
      name: 'the Queued tab with no tab to its right',
      tabPathSegment: 'queued',
      tabLabel: 'Queued',
      tabTasks: {
        queued: [QUEUED_TASK],
        prs: [FIRST_AWAITING_OWNER_TASK],
      },
      submittedTask: QUEUED_TASK,
      tabLabelAfterSubmission: 'Queued',
    },
  ];

  it.each(tabAtSubmissionCases)(
    'Undo of a Set Depended Issue submission returns the tab active at the submission with the submitted task in the panel: $name',
    async ({
      tabPathSegment,
      tabLabel,
      tabTasks,
      submittedTask,
      tabLabelAfterSubmission,
    }) => {
      const view = renderScenario(buildScenario(tabTasks), tabPathSegment);
      await openTaskFromList(view, submittedTask);

      await submitDependedIssueUrl(view);

      await waitFor(() => {
        expect(activeTabLabel()).toBe(tabLabelAfterSubmission);
      });
      expect(view.container.querySelector('.console-detail-screen')).toBeNull();

      pressUndo(view);

      await waitFor(() => {
        expect(activeTabLabel()).toBe(tabLabel);
        expect(detailPanelTaskLabel(view.container)).toBe(
          panelLabelOf(submittedTask),
        );
      });
    },
  );

  type SnapshotAfterPressCase = {
    name: string;
    pressesUndo: boolean;
    refreshedSnapshotGeneratedAt: string;
    expectedStatusBadge: string;
  };

  const snapshotAfterPressCases: SnapshotAfterPressCase[] = [
    {
      name: 'a snapshot generated after the submission press without Undo',
      pressesUndo: false,
      refreshedSnapshotGeneratedAt: '2026-06-19T00:01:00.000Z',
      expectedStatusBadge: 'Todo by human',
    },
    {
      name: 'a snapshot generated after the Undo press',
      pressesUndo: true,
      refreshedSnapshotGeneratedAt: '2026-06-19T00:01:00.000Z',
      expectedStatusBadge: 'Todo by human',
    },
    {
      name: 'a snapshot generated before the submission press without Undo',
      pressesUndo: false,
      refreshedSnapshotGeneratedAt: '2026-06-19T00:00:05.000Z',
      expectedStatusBadge: 'Awaiting Workspace',
    },
  ];

  it.each(snapshotAfterPressCases)(
    'Status badge of the submitted task shows the Status of the loaded snapshot rather than the held Status once a newer snapshot loads: $name',
    async ({
      pressesUndo,
      refreshedSnapshotGeneratedAt,
      expectedStatusBadge,
    }) => {
      jest.useFakeTimers({ now: new Date(SUBMISSION_PRESS_TIME) });
      try {
        const scenario = buildScenario({
          prs: [FIRST_AWAITING_OWNER_TASK, SECOND_AWAITING_OWNER_TASK],
        });
        const view = renderScenario(scenario);
        await openTaskFromList(view, FIRST_AWAITING_OWNER_TASK);
        await submitDependedIssueUrl(view);
        if (pressesUndo) {
          pressUndo(view);
        }

        scenario.generatedAt = refreshedSnapshotGeneratedAt;
        scenario.tabTasks = {
          prs: [
            { ...FIRST_AWAITING_OWNER_TASK, status: 'Todo by human' },
            SECOND_AWAITING_OWNER_TASK,
          ],
        };
        await advanceFakeTimersAndFlushPromises(
          CONSOLE_TAB_REFRESH_INTERVAL_MS,
        );

        await act(async () => {
          window.location.hash = `#item/${projectItemIdOf(FIRST_AWAITING_OWNER_TASK)}`;
          window.dispatchEvent(new Event('hashchange'));
        });

        await waitFor(() => {
          expect(detailPanelTaskLabel(view.container)).toBe(
            panelLabelOf(FIRST_AWAITING_OWNER_TASK),
          );
          expect(detailStatusBadgeText(view.container)).toBe(
            expectedStatusBadge,
          );
        });
      } finally {
        jest.useRealTimers();
      }
    },
  );

  type OwnNavigationCase = {
    name: string;
    tabTasks: ScenarioState['tabTasks'];
    submittedTask: ScenarioTask;
    tabLabelAfterSubmission: string;
    panelTaskLabelAfterSubmission: string | null;
    navigate: (view: ScenarioView) => Promise<void>;
    tabLabelAfterNavigation: string;
    panelTaskLabelAfterNavigation: string | null;
  };

  const ownNavigationCases: OwnNavigationCase[] = [
    {
      name: 'a tab button click',
      tabTasks: {
        'todo-by-human': [TODO_BY_HUMAN_TASK],
        prs: [FIRST_AWAITING_OWNER_TASK],
        queued: [QUEUED_TASK],
      },
      submittedTask: FIRST_AWAITING_OWNER_TASK,
      tabLabelAfterSubmission: 'Queued',
      panelTaskLabelAfterSubmission: null,
      navigate: async () => {
        fireEvent.click(within(tabBar()).getByText('Todo by human'));
      },
      tabLabelAfterNavigation: 'Todo by human',
      panelTaskLabelAfterNavigation: null,
    },
    {
      name: 'a row click',
      tabTasks: {
        prs: [FIRST_AWAITING_OWNER_TASK],
        queued: [QUEUED_TASK],
      },
      submittedTask: FIRST_AWAITING_OWNER_TASK,
      tabLabelAfterSubmission: 'Queued',
      panelTaskLabelAfterSubmission: null,
      navigate: async (view) => {
        fireEvent.click(view.getByText(QUEUED_TASK.title));
      },
      tabLabelAfterNavigation: 'Queued',
      panelTaskLabelAfterNavigation: panelLabelOf(QUEUED_TASK),
    },
    {
      name: 'a swipe on the detail screen',
      tabTasks: {
        prs: [
          FIRST_AWAITING_OWNER_TASK,
          SECOND_AWAITING_OWNER_TASK,
          THIRD_AWAITING_OWNER_TASK,
        ],
      },
      submittedTask: FIRST_AWAITING_OWNER_TASK,
      tabLabelAfterSubmission: 'Awaiting Owner',
      panelTaskLabelAfterSubmission: panelLabelOf(SECOND_AWAITING_OWNER_TASK),
      navigate: async (view) => {
        const detailScreen = view.container.querySelector(
          '.console-detail-screen',
        );
        expect(detailScreen).not.toBeNull();
        swipeDetailScreen(
          detailScreen as HTMLElement,
          { clientX: 240, clientY: 100 },
          { clientX: 40, clientY: 110 },
        );
      },
      tabLabelAfterNavigation: 'Awaiting Owner',
      panelTaskLabelAfterNavigation: panelLabelOf(THIRD_AWAITING_OWNER_TASK),
    },
  ];

  it.each(ownNavigationCases)(
    'Undo of a Set Depended Issue submission does not override the owner navigation made after the submission: $name',
    async ({
      tabTasks,
      submittedTask,
      tabLabelAfterSubmission,
      panelTaskLabelAfterSubmission,
      navigate,
      tabLabelAfterNavigation,
      panelTaskLabelAfterNavigation,
    }) => {
      const view = renderScenario(buildScenario(tabTasks));
      await openTaskFromList(view, submittedTask);
      await submitDependedIssueUrl(view);
      await waitFor(() => {
        expect(activeTabLabel()).toBe(tabLabelAfterSubmission);
        expect(detailPanelTaskLabel(view.container)).toBe(
          panelTaskLabelAfterSubmission,
        );
      });

      await navigate(view);
      await waitFor(() => {
        expect(activeTabLabel()).toBe(tabLabelAfterNavigation);
        expect(detailPanelTaskLabel(view.container)).toBe(
          panelTaskLabelAfterNavigation,
        );
      });

      pressUndo(view);

      await waitFor(() => {
        expect(tabBadgeCount('Awaiting Owner')).not.toBeNull();
      });
      expect(activeTabLabel()).toBe(tabLabelAfterNavigation);
      expect(detailPanelTaskLabel(view.container)).toBe(
        panelTaskLabelAfterNavigation,
      );
    },
  );

  type HeldWriteCase = {
    name: string;
    renderWithHeldWrites: () => Promise<ScenarioView>;
    expectedSentWriteCount: number;
  };

  const heldWriteCases: HeldWriteCase[] = [
    {
      name: 'airplane mode is on at the countdown end',
      renderWithHeldWrites: async () => {
        installAirplaneEnvironment([
          FIRST_AWAITING_OWNER_TASK,
          SECOND_AWAITING_OWNER_TASK,
        ]);
        const view = render(<ConsolePage />);
        await waitFor(() => {
          expect(view.getByText('Turn off')).toBeInTheDocument();
        });
        return view;
      },
      expectedSentWriteCount: 0,
    },
    {
      name: 'the write request rejects without an HTTP response',
      renderWithHeldWrites: async () => {
        const scenario = buildScenario({
          prs: [FIRST_AWAITING_OWNER_TASK, SECOND_AWAITING_OWNER_TASK],
        });
        scenario.writeOutcome = 'rejects without an HTTP response';
        return renderScenario(scenario);
      },
      expectedSentWriteCount: 1,
    },
  ];

  it.each(heldWriteCases)(
    'Set Depended Issue holds both writes in the offline pending panel and keeps the panel switch in place when $name',
    async ({ renderWithHeldWrites, expectedSentWriteCount }) => {
      jest.useFakeTimers();
      try {
        const view = await renderWithHeldWrites();
        await openTaskFromList(view, FIRST_AWAITING_OWNER_TASK);
        await submitDependedIssueUrl(view);
        await waitFor(() => {
          expect(detailPanelTaskLabel(view.container)).toBe(
            panelLabelOf(SECOND_AWAITING_OWNER_TASK),
          );
        });

        await advanceFakeTimersAndFlushPromises(ACTION_TOAST_DELAY_MS + 1000);

        await waitFor(() => {
          expect(offlinePanelHeaderText(view.container)).toMatch(
            /^2 actions held/,
          );
        });
        expect(readStoredOfflineApiPaths()).toEqual([
          '/api/setdependedissueurl',
          '/api/triage',
        ]);
        expect(postedRequestPaths()).toHaveLength(expectedSentWriteCount);
        expect(activeTabLabel()).toBe('Awaiting Owner');
        expect(detailPanelTaskLabel(view.container)).toBe(
          panelLabelOf(SECOND_AWAITING_OWNER_TASK),
        );
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('Undo of a Set Depended Issue submission cancels both writes and restores the Awaiting Owner count', async () => {
    jest.useFakeTimers();
    try {
      const view = renderScenario(
        buildScenario({
          prs: [FIRST_AWAITING_OWNER_TASK, SECOND_AWAITING_OWNER_TASK],
        }),
      );
      await openTaskFromList(view, FIRST_AWAITING_OWNER_TASK);
      await submitDependedIssueUrl(view);
      await waitFor(() => {
        expect(tabBadgeCount('Awaiting Owner')).toBe('1');
      });

      pressUndo(view);
      await advanceFakeTimersAndFlushPromises(ACTION_TOAST_DELAY_MS + 1000);

      expect(postedRequestPaths()).toEqual([]);
      await waitFor(() => {
        expect(tabBadgeCount('Awaiting Owner')).toBe('2');
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('Set Depended Issue sends the depended issue write and then the Status write when the countdown ends without Undo', async () => {
    jest.useFakeTimers();
    try {
      const view = renderScenario(
        buildScenario({
          prs: [FIRST_AWAITING_OWNER_TASK, SECOND_AWAITING_OWNER_TASK],
        }),
      );
      await openTaskFromList(view, FIRST_AWAITING_OWNER_TASK);
      await submitDependedIssueUrl(view);

      await advanceFakeTimersAndFlushPromises(ACTION_TOAST_DELAY_MS + 1000);

      await waitFor(() => {
        expect(postedRequestPaths()).toEqual([
          '/api/setdependedissueurl',
          '/api/triage',
        ]);
      });
      expect(detailPanelTaskLabel(view.container)).toBe(
        panelLabelOf(SECOND_AWAITING_OWNER_TASK),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  type AddressChangeCase = {
    name: string;
    tabTasks: ScenarioState['tabTasks'];
    changeAddress: () => Promise<void>;
    tabLabelAfterAddressChange: string;
    panelTaskLabelAfterAddressChange: string | null;
  };

  const addressChangeCases: AddressChangeCase[] = [
    {
      name: 'the hash changes to another task',
      tabTasks: {
        prs: [
          FIRST_AWAITING_OWNER_TASK,
          SECOND_AWAITING_OWNER_TASK,
          THIRD_AWAITING_OWNER_TASK,
        ],
      },
      changeAddress: async () => {
        await act(async () => {
          window.location.hash = `#item/${projectItemIdOf(THIRD_AWAITING_OWNER_TASK)}`;
          window.dispatchEvent(new Event('hashchange'));
        });
      },
      tabLabelAfterAddressChange: 'Awaiting Owner',
      panelTaskLabelAfterAddressChange: panelLabelOf(THIRD_AWAITING_OWNER_TASK),
    },
    {
      name: 'the path changes to another tab and popstate fires',
      tabTasks: {
        prs: [FIRST_AWAITING_OWNER_TASK, SECOND_AWAITING_OWNER_TASK],
        queued: [QUEUED_TASK],
      },
      changeAddress: async () => {
        await act(async () => {
          window.history.pushState({}, '', '/projects/acme/queued?k=token');
          window.dispatchEvent(new PopStateEvent('popstate'));
        });
      },
      tabLabelAfterAddressChange: 'Queued',
      panelTaskLabelAfterAddressChange: null,
    },
  ];

  it.each(addressChangeCases)(
    'Undo of a Set Depended Issue submission does not override the page address changed after the submission: $name',
    async ({
      tabTasks,
      changeAddress,
      tabLabelAfterAddressChange,
      panelTaskLabelAfterAddressChange,
    }) => {
      const view = renderScenario(buildScenario(tabTasks));
      await openTaskFromList(view, FIRST_AWAITING_OWNER_TASK);
      await submitDependedIssueUrl(view);
      await waitFor(() => {
        expect(activeTabLabel()).toBe('Awaiting Owner');
        expect(detailPanelTaskLabel(view.container)).toBe(
          panelLabelOf(SECOND_AWAITING_OWNER_TASK),
        );
      });

      await changeAddress();
      await waitFor(() => {
        expect(activeTabLabel()).toBe(tabLabelAfterAddressChange);
        expect(detailPanelTaskLabel(view.container)).toBe(
          panelTaskLabelAfterAddressChange,
        );
      });

      pressUndo(view);

      await waitFor(() => {
        expect(tabBadgeCount('Awaiting Owner')).not.toBeNull();
      });
      expect(activeTabLabel()).toBe(tabLabelAfterAddressChange);
      expect(detailPanelTaskLabel(view.container)).toBe(
        panelTaskLabelAfterAddressChange,
      );
    },
  );

  const pressUndoOnToastNaming = (
    view: ScenarioView,
    task: ScenarioTask,
  ): void => {
    const undoButton = view
      .getAllByRole('button', { name: 'Undo' })
      .find((button) =>
        button
          .closest('.console-undo-toast')
          ?.textContent?.includes(`o/r#${task.number}`),
      );
    if (undoButton === undefined) {
      throw new Error(`No Undo toast names o/r#${task.number}`);
    }
    fireEvent.click(undoButton);
  };

  it('Undo of a Set Depended Issue submission does not override the panel switch made by another queued action', async () => {
    const view = renderScenario(
      buildScenario({
        prs: [
          FIRST_AWAITING_OWNER_TASK,
          SECOND_AWAITING_OWNER_TASK,
          THIRD_AWAITING_OWNER_TASK,
        ],
      }),
    );
    await openTaskFromList(view, FIRST_AWAITING_OWNER_TASK);
    await submitDependedIssueUrl(view);
    await waitFor(() => {
      expect(detailPanelTaskLabel(view.container)).toBe(
        panelLabelOf(SECOND_AWAITING_OWNER_TASK),
      );
    });

    await submitAwaitingWorkspaceFromStatusChooser(view);
    await waitFor(() => {
      expect(detailPanelTaskLabel(view.container)).toBe(
        panelLabelOf(THIRD_AWAITING_OWNER_TASK),
      );
    });
    expect(tabBadgeCount('Awaiting Owner')).toBe('1');
    expect(view.getAllByRole('button', { name: 'Undo' })).toHaveLength(2);

    pressUndoOnToastNaming(view, FIRST_AWAITING_OWNER_TASK);

    await waitFor(() => {
      expect(tabBadgeCount('Awaiting Owner')).toBe('2');
    });
    expect(activeTabLabel()).toBe('Awaiting Owner');
    expect(detailPanelTaskLabel(view.container)).toBe(
      panelLabelOf(THIRD_AWAITING_OWNER_TASK),
    );
  });
});
