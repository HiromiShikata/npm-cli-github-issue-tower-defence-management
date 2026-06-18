import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import {
  consoleItemBodyFixture,
  consolePullRequestDetailFixture,
  consoleRelatedPullRequestsFixture,
  consoleStatusTabFixture,
  consoleTriageTabFixture,
} from '../fixtures';
import { ConsolePage } from './ConsolePage';

const jsonResponse = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const tabPayloads: Record<string, unknown> = {
  prs: consoleStatusTabFixture,
  triage: consoleTriageTabFixture,
  unread: { ...consoleStatusTabFixture, items: [] },
  'failed-preparation': { ...consoleStatusTabFixture, items: [] },
  'todo-by-human': { ...consoleStatusTabFixture, items: [] },
};

const stubbedFetch = async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.toString();
  const tabMatch =
    /\/(prs|triage|unread|failed-preparation|todo-by-human)\/list\.json/.exec(
      url,
    );
  if (tabMatch !== null) {
    return jsonResponse(tabPayloads[tabMatch[1]]);
  }
  if (url.includes('/api/itembody')) {
    return jsonResponse(consoleItemBodyFixture);
  }
  if (url.includes('/api/comments')) {
    return jsonResponse({ comments: consoleItemBodyFixture.comments });
  }
  if (url.includes('/api/relatedprs')) {
    return jsonResponse({ prs: consoleRelatedPullRequestsFixture });
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

const FetchStubbedConsolePage = () => {
  useEffect(() => {
    const original = window.fetch;
    window.fetch = stubbedFetch as typeof window.fetch;
    return () => {
      window.fetch = original;
    };
  }, []);
  return <ConsolePage />;
};

const meta: Meta<typeof ConsolePage> = {
  title: 'Console/ConsolePage',
  component: ConsolePage,
  render: () => <FetchStubbedConsolePage />,
};

export default meta;

type Story = StoryObj<typeof ConsolePage>;

export const Default: Story = {};
