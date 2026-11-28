import * as path from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import {
  type ConsoleE2eHarness,
  startConsoleE2eHarness,
} from './consoleTestHarness';

const ITEM_TITLE =
  'Resolve the shared GitHub token rate-limit exhaustion blocker';
const SUCCESSFUL_FILE_NAME = 'successful-attachment.png';
const FAILED_FILE_NAME = 'failed-attachment.txt';
const UPLOAD_FAILURE_REASON = 'e2e distinctive upload failure reason';
const SUCCESSFUL_MARKDOWN = `![${SUCCESSFUL_FILE_NAME}](https://example.com/${SUCCESSFUL_FILE_NAME})`;
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tabByLabel = (page: Page, label: string) =>
  page.locator('.console-tab', { hasText: label });

const itemRowByText = (page: Page, text: string) =>
  page.locator('.console-item-row', { hasText: text });

const openFixtureItem = async (
  page: Page,
  harness: ConsoleE2eHarness,
): Promise<void> => {
  await page.goto(harness.appRootUrl);
  await tabByLabel(page, 'Workflow Blocker').click();
  await itemRowByText(page, ITEM_TITLE).click();
};

test('keeps the successful attachment after a partial upload failure', async ({
  page,
}) => {
  const harness = await startConsoleE2eHarness({
    uploadAttachmentFailure: {
      fileName: FAILED_FILE_NAME,
      error: UPLOAD_FAILURE_REASON,
    },
  });

  try {
    await openFixtureItem(page, harness);

    const composerToggle = page.locator('.console-composer-toggle');
    const composer = page.locator('.console-composer-input');
    if ((await composer.count()) === 0) {
      await composerToggle.click();
    }
    await expect(composer).toBeVisible();

    await page.getByLabel('Attach files').setInputFiles([
      {
        name: SUCCESSFUL_FILE_NAME,
        mimeType: 'image/png',
        buffer: Buffer.from('successful attachment'),
      },
      {
        name: FAILED_FILE_NAME,
        mimeType: 'text/plain',
        buffer: Buffer.from('failed attachment'),
      },
    ]);

    await expect
      .poll(() => harness.uploadAttachmentRequestCalls.length)
      .toBe(1);
    expect(
      harness.uploadAttachmentRequestCalls[0]?.files.map(
        (file) => file.fileName,
      ),
    ).toEqual([SUCCESSFUL_FILE_NAME, FAILED_FILE_NAME]);
    expect(harness.uploadAttachmentCalls).toHaveLength(2);

    await expect(composer).toHaveValue(
      new RegExp(escapeRegExp(SUCCESSFUL_MARKDOWN)),
    );
    await expect(composer).not.toHaveValue(
      new RegExp(escapeRegExp(`![uploading ${SUCCESSFUL_FILE_NAME}]()`)),
    );
    await expect(composer).not.toHaveValue(
      new RegExp(escapeRegExp(`![uploading ${FAILED_FILE_NAME}]()`)),
    );

    const screenshotDirectory = process.env.CONSOLE_E2E_SCREENSHOT_DIR;
    if (screenshotDirectory !== undefined) {
      await page.screenshot({
        path: path.join(screenshotDirectory, 'attachment-partial-failure.png'),
        fullPage: false,
      });
    }

    await expect(
      page.getByText(/Operation failed: e2e distinctive upload failure reason/),
    ).toBeVisible();
  } finally {
    await harness.stop();
  }
});
