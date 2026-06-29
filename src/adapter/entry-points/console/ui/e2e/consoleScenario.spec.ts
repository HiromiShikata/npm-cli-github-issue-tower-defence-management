import { expect, type Page, test } from '@playwright/test';
import {
  type ConsoleE2eHarness,
  startConsoleE2eHarness,
} from './consoleTestHarness';

let harness: ConsoleE2eHarness;

test.beforeAll(async () => {
  harness = await startConsoleE2eHarness();
});

test.afterAll(async () => {
  if (harness !== undefined) {
    await harness.stop();
  }
});

const activeTabLabel = (page: Page) =>
  page.locator('.console-tab[data-active="true"] .console-tab-label');

const tabByLabel = (page: Page, label: string) =>
  page.locator('.console-tab', { hasText: label });

const tabBadge = (page: Page, label: string) =>
  tabByLabel(page, label).locator('.console-tab-badge');

const itemRowByText = (page: Page, text: string) =>
  page.locator('.console-item-row', { hasText: text });

const processSelectedItemViaStatus = async (page: Page): Promise<void> => {
  const statusButton = page
    .locator('.console-op-button', { hasText: 'Awaiting Workspace' })
    .first();
  await expect(statusButton).toBeVisible();
  await statusButton.click();
};

test('shows CI and conflict badges in the directly opened PR detail header', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await tabByLabel(page, 'Awaiting Quality Check').click();
  await itemRowByText(
    page,
    'Serve the committed console UI bundle from serveConsole',
  ).click();

  const title = page.locator('.console-detail-title');
  await expect(title.getByText('CI failing')).toHaveCount(0);

  const statusRow = page.locator('.console-detail-pr-status-row');
  await expect(statusRow.getByText('CI failing')).toBeVisible();
  await expect(statusRow.getByText(/missing: build, test/)).toBeVisible();
  await expect(statusRow.getByText('Conflict')).toBeVisible();
  await expect(statusRow.getByText('Out of date')).toBeVisible();

  await page.locator('.console-detail').screenshot({
    path: '/tmp/after-pr-detail-header.png',
  });
});

test('processing tabs drives auto-advance and keeps emptied badges at zero', async ({
  page,
}) => {
  await page.goto(harness.appUrl);

  await expect(activeTabLabel(page)).toHaveText('Awaiting Quality Check');
  await expect(tabBadge(page, 'Awaiting Quality Check')).toHaveText('1');
  await expect(tabBadge(page, 'Unread')).toHaveText('2');
  await expect(tabBadge(page, 'Triage')).toHaveText('2');
  await expect(tabBadge(page, 'Todo by human')).toHaveText('1');

  await itemRowByText(
    page,
    'Serve the committed console UI bundle from serveConsole',
  ).click();
  const approveButton = page
    .locator('.console-op-button', { hasText: 'Approve' })
    .first();
  await expect(approveButton).toBeVisible();
  await approveButton.click();

  await expect(activeTabLabel(page)).toHaveText('Triage', { timeout: 8000 });
  await expect(tabByLabel(page, 'Awaiting Quality Check')).toHaveCount(0, {
    timeout: 8000,
  });

  await itemRowByText(
    page,
    'Add Sonnet to Opus weekly-limit fallback routing per token',
  ).click();
  await processSelectedItemViaStatus(page);
  await expect(tabBadge(page, 'Triage')).toHaveText('1', { timeout: 8000 });
  await tabByLabel(page, 'Triage').click();

  await itemRowByText(
    page,
    'Publish the generated documentation site to GitHub Pages',
  ).click();
  await processSelectedItemViaStatus(page);

  await expect(activeTabLabel(page)).toHaveText('Unread', { timeout: 8000 });
  await expect(tabByLabel(page, 'Triage')).toHaveCount(0, {
    timeout: 8000,
  });

  await tabByLabel(page, 'Todo by human').click();
  await expect(activeTabLabel(page)).toHaveText('Todo by human');
  await expect(tabByLabel(page, 'Triage')).toHaveCount(0);
  await expect(tabBadge(page, 'Todo by human')).toHaveText('1');

  await tabByLabel(page, 'Unread').click();
  await expect(activeTabLabel(page)).toHaveText('Unread');
  await expect(tabByLabel(page, 'Triage')).toHaveCount(0);
  await expect(tabBadge(page, 'Unread')).toHaveText('2');
});

test('renders the Workflow Blocker tab leftmost and shows its detail operations', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await expect(activeTabLabel(page)).toHaveText('Workflow Blocker');
  await expect(tabBadge(page, 'Workflow Blocker')).toHaveText('1');

  const labels = page.locator('.console-tab .console-tab-label');
  await expect(labels.nth(0)).toHaveText('Workflow Blocker');

  await expect(page.locator('.console-tab-count-heading')).toHaveCount(0);

  await itemRowByText(
    page,
    'Resolve the shared GitHub token rate-limit exhaustion blocker',
  ).click();

  await expect(
    page.locator('.console-op-button', { hasText: 'Awaiting Workspace' }),
  ).toBeVisible();
  await expect(
    page.locator('.console-op-button', { hasText: 'Close as not planned' }),
  ).toBeVisible();
  await expect(
    page.locator('.console-op-button', { hasText: '+1 day' }),
  ).toBeVisible();
});

test('adds an inline review comment on a related pull request diff without hover on a touch viewport', async ({
  browser,
}) => {
  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await touchContext.newPage();

  await page.goto(harness.appRootUrl);

  await tabByLabel(page, 'Failed Preparation').click();
  await itemRowByText(
    page,
    'Add inline review comments on the related pull request diff',
  ).click();

  const changedFile = page
    .locator('.console-file-row', {
      hasText: 'src/adapter/entry-points/console/ui/src/index.css',
    })
    .first();
  await expect(changedFile).toBeVisible();
  await changedFile.click();

  const commentButton = page.locator('.console-diff-comment-button').first();
  await expect(commentButton).toBeVisible();
  const opacity = await commentButton.evaluate(
    (element) => window.getComputedStyle(element).opacity,
  );
  expect(Number(opacity)).toBeGreaterThan(0);

  await commentButton.click();
  await page
    .locator('.console-diff-composer-input')
    .fill('Please verify this opacity change on touch devices.');
  await page.locator('.console-diff-composer-submit').click();

  await expect(page.locator('.console-diff-composer-posted')).toHaveText(
    'Comment posted.',
  );

  expect(harness.reviewCommentCalls).toHaveLength(1);
  expect(harness.reviewCommentCalls[0].url).toBe(
    'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/912',
  );
  expect(harness.reviewCommentCalls[0].body).toBe(
    'Please verify this opacity change on touch devices.',
  );

  await touchContext.close();
});

test('shows CI, conflict and out-of-date badges in the related PR header', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await tabByLabel(page, 'Failed Preparation').click();
  await itemRowByText(
    page,
    'Add inline review comments on the related pull request diff',
  ).click();

  const prHeader = page.locator('.console-pr-header').first();
  await expect(prHeader.getByText('CI failing')).toBeVisible();
  await expect(prHeader.getByText(/missing: build, test/)).toBeVisible();
  await expect(prHeader.getByText('Conflict')).toBeVisible();
  await expect(prHeader.getByText('Out of date')).toBeVisible();

  await prHeader.screenshot({
    path: '/tmp/after-related-pr-header.png',
  });
});
