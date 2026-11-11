import { expect, type Page, test } from '@playwright/test';
import {
  type ConsoleE2eHarness,
  startConsoleE2eHarness,
} from './consoleTestHarness';

const ITEM_TITLE =
  'Resolve the shared GitHub token rate-limit exhaustion blocker';
const QUEUE_KEY = 'console-offline-action-queue';

const tabByLabel = (page: Page, label: string) =>
  page.locator('.console-tab', { hasText: label });

const itemRowByText = (page: Page, text: string) =>
  page.locator('.console-item-row', { hasText: text });

const openFixtureItem = async (page: Page, harness: ConsoleE2eHarness) => {
  await page.goto(harness.appRootUrl);
  await tabByLabel(page, 'Workflow Blocker').click();
  await itemRowByText(page, ITEM_TITLE).click();
};

const pressCommentAndAwaitingWorkspace = async (page: Page): Promise<void> => {
  await page.locator('.console-composer-input').fill('persistent handoff');
  await page
    .getByRole('button', {
      name: 'Comment & Awaiting Workspace',
      exact: true,
    })
    .click();
};

test.describe('console action persistence acceptance scenarios', () => {
  let harness: ConsoleE2eHarness;

  test.beforeEach(async () => {
    harness = await startConsoleE2eHarness();
  });

  test.afterEach(async () => {
    await harness.stop();
  });

  test('timer mode persists Comment & Awaiting Workspace before reload and posts exactly once', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'tdpm-timer-settings',
        JSON.stringify({
          timerMode: true,
          projectMinutes: { acme: 30, beta: 30 },
        }),
      );
    });
    await openFixtureItem(page, harness);
    await pressCommentAndAwaitingWorkspace(page);

    const persisted = await page.evaluate(
      (key) => localStorage.getItem(key),
      QUEUE_KEY,
    );
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted ?? '[]')).toEqual([
      expect.objectContaining({ id: expect.any(String) }),
    ]);

    await page.reload();
    await expect
      .poll(
        () =>
          harness.commentCalls.filter((c) => c.body === 'persistent handoff')
            .length,
      )
      .toBe(1);
  });

  test('page hidden during the grace sends the action once', async ({
    page,
  }) => {
    await openFixtureItem(page, harness);
    await pressCommentAndAwaitingWorkspace(page);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect
      .poll(
        () =>
          harness.commentCalls.filter((c) => c.body === 'persistent handoff')
            .length,
      )
      .toBe(1);
  });

  test('project switch during the grace does not duplicate the action', async ({
    page,
  }) => {
    await openFixtureItem(page, harness);
    await pressCommentAndAwaitingWorkspace(page);
    await page.locator('.console-tab-pjname button').click();
    await page
      .locator('.console-tab-pjname-option', { hasText: 'beta' })
      .click();

    await expect
      .poll(
        () =>
          harness.commentCalls.filter((c) => c.body === 'persistent handoff')
            .length,
      )
      .toBe(1);
  });

  test('Undo removes the persisted action and posts nothing', async ({
    page,
  }) => {
    await openFixtureItem(page, harness);
    await pressCommentAndAwaitingWorkspace(page);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();

    await expect
      .poll(
        () =>
          harness.commentCalls.filter((c) => c.body === 'persistent handoff')
            .length,
      )
      .toBe(0);
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), QUEUE_KEY))
      .toBe('[]');
  });
});
