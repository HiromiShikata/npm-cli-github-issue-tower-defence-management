import { expect, type Page, test } from '@playwright/test';
import {
  type ConsoleE2eHarness,
  startConsoleE2eHarness,
} from './consoleTestHarness';

const activeTabLabel = (page: Page) =>
  page.locator('.console-tab[data-active="true"] .console-tab-label');

const itemRowByText = (page: Page, text: string) =>
  page.locator('.console-item-row', { hasText: text });

const waitForServiceWorkerControl = (page: Page) =>
  page.waitForFunction(
    async () => {
      const registration = await navigator.serviceWorker.ready;
      return (
        registration.active !== null &&
        navigator.serviceWorker.controller !== null
      );
    },
    { timeout: 10_000 },
  );

test('navigating offline to a previously visited /projects/acme/prs URL renders the cached console UI instead of a blank page (direct-URL deep-link, the exact offline navigation defect fixed by #3213, not a general navigation shortcut)', async ({
  page,
}) => {
  const harness: ConsoleE2eHarness = await startConsoleE2eHarness();
  try {
    await page.goto(harness.appUrl);
    await waitForServiceWorkerControl(page);

    await page.reload();
    await waitForServiceWorkerControl(page);

    await page.goto(harness.appUrl);
    await waitForServiceWorkerControl(page);

    await page.context().setOffline(true);

    await page.goto(harness.appUrl);

    await expect(page.locator('.console-tab')).not.toHaveCount(0);
    await expect(activeTabLabel(page)).toHaveText('Awaiting Owner');
    await expect(
      itemRowByText(
        page,
        'Serve the committed console UI bundle from serveConsole',
      ),
    ).toBeVisible();
  } finally {
    await page.context().setOffline(false);
    await harness.stop();
  }
});

test('the Web App Manifest is linked from index.html and fetchable without credentials with the correct content type', async ({
  page,
}) => {
  const harness: ConsoleE2eHarness = await startConsoleE2eHarness();
  try {
    await page.goto(harness.appUrl);

    const manifestHref = await page.getAttribute(
      'link[rel="manifest"]',
      'href',
    );
    expect(manifestHref).toBe('/manifest.webmanifest');

    const manifestResponse = await page.evaluate(async (href: string) => {
      const response = await fetch(href, { credentials: 'omit' });
      return {
        status: response.status,
        contentType: response.headers.get('content-type'),
        body: await response.json(),
      };
    }, manifestHref ?? '');

    expect(manifestResponse.status).toBe(200);
    expect(manifestResponse.contentType).toBe(
      'application/manifest+json; charset=utf-8',
    );
    expect(manifestResponse.body).toMatchObject({
      name: 'TDPM Console',
      short_name: 'TDPM',
      start_url: '/',
      display: 'standalone',
    });
    expect(manifestResponse.body.icons).toHaveLength(2);
  } finally {
    await harness.stop();
  }
});
