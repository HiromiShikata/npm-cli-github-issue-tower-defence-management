import { expect, test } from '@playwright/test';
import {
  type ConsoleE2eHarness,
  startConsoleE2eHarness,
} from './consoleTestHarness';

const itemTitle =
  'Resolve the shared GitHub token rate-limit exhaustion blocker';
const issueUrl =
  'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/720';

test.describe('console action replay', () => {
  let harness: ConsoleE2eHarness;

  test.beforeEach(async () => {
    harness = await startConsoleE2eHarness();
  });

  test.afterEach(async () => {
    await harness.stop();
  });

  test('replays a persisted OK close delivery without duplicating the comment or close', async ({
    page,
  }) => {
    let releaseResponse: () => void = () => undefined;
    const responseReleased = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    let responseFetched: () => void = () => undefined;
    const responseIsFetched = new Promise<void>((resolve) => {
      responseFetched = resolve;
    });
    let held = false;
    let triagePostCount = 0;
    let handledTriageCount = 0;

    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname.includes('/api/triage')
      ) {
        triagePostCount += 1;
      }
    });

    await page.route('**/api/triage*', async (route) => {
      const response = await route.fetch();
      if (!held) {
        held = true;
        responseFetched();
        await responseReleased;
      }
      await route.fulfill({ response });
      handledTriageCount += 1;
    });

    await page.goto(harness.appRootUrl);
    await page.locator('.console-tab', { hasText: 'Workflow Blocker' }).click();
    await page.locator('.console-item-row', { hasText: itemTitle }).click();
    await page.getByRole('button', { name: 'OK & Close', exact: true }).click();

    await responseIsFetched;
    await page.reload();
    releaseResponse();

    await expect.poll(() => triagePostCount).toBeGreaterThanOrEqual(2);
    await expect
      .poll(
        () =>
          harness.commentCalls.filter(
            (call) => call.url === issueUrl && call.body === 'ok',
          ).length,
      )
      .toBe(1);
    await expect.poll(() => harness.closeIssueCalls.length).toBe(1);
    await expect.poll(() => handledTriageCount).toBeGreaterThanOrEqual(2);
  });
});
