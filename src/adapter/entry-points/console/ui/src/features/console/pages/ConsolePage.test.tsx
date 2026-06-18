import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  consoleItemBodyFixture,
  consolePullRequestDetailFixture,
  consoleStatusTabFixture,
} from '../fixtures';
import { ConsolePage } from './ConsolePage';

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn(async () => ({ svg: '<svg></svg>' })),
  },
}));

const jsonResponse = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const stubFetch = (url: string): Response => {
  if (url.includes('/prs/list.json')) {
    return jsonResponse(consoleStatusTabFixture);
  }
  if (url.includes('list.json')) {
    return jsonResponse({ ...consoleStatusTabFixture, items: [] });
  }
  if (url.includes('/api/itembody')) {
    return jsonResponse(consoleItemBodyFixture);
  }
  if (url.includes('/api/prdetail')) {
    return jsonResponse({ detail: consolePullRequestDetailFixture });
  }
  if (url.includes('/api/prfiles')) {
    return jsonResponse({ files: consolePullRequestDetailFixture.files });
  }
  if (url.includes('/api/prcommits')) {
    return jsonResponse({ commits: consolePullRequestDetailFixture.commits });
  }
  return jsonResponse({ ok: true });
};

describe('ConsolePage', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?k=test-token');
    jest
      .spyOn(window, 'fetch')
      .mockImplementation(async (input) =>
        stubFetch(typeof input === 'string' ? input : input.toString()),
      );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the active tab list grouped by story', async () => {
    render(<ConsolePage />);
    expect(
      await screen.findByText('TDPM Console port', undefined, {
        timeout: 5000,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(consoleStatusTabFixture.items[0].title),
    ).toBeInTheDocument();
  });

  it('opens the detail view when an item is selected', async () => {
    const user = userEvent.setup();
    render(<ConsolePage />);
    const itemTitle = await screen.findByText(
      consoleStatusTabFixture.items[0].title,
      undefined,
      { timeout: 5000 },
    );
    await user.click(itemTitle);
    expect(await screen.findByText('Back to list')).toBeInTheDocument();
  });
});
