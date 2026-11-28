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
const SINGLE_FAILED_FILE_NAME = 'single-failed-attachment.txt';
const NAVIGATION_FILE_NAME = 'navigation-attachment.png';
const UPLOAD_FAILURE_REASON = 'e2e distinctive upload failure reason';
const SINGLE_UPLOAD_FAILURE_REASON = 'e2e single file upload failure reason';
const SUCCESSFUL_MARKDOWN = `![${SUCCESSFUL_FILE_NAME}](https://example.com/${SUCCESSFUL_FILE_NAME})`;
const NAVIGATION_MARKDOWN = `![${NAVIGATION_FILE_NAME}](https://example.com/${NAVIGATION_FILE_NAME})`;
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

test('shows the error for a single file that fails to upload', async ({
  page,
}) => {
  const harness = await startConsoleE2eHarness({
    uploadAttachmentFailure: {
      fileName: SINGLE_FAILED_FILE_NAME,
      error: SINGLE_UPLOAD_FAILURE_REASON,
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

    await page.getByLabel('Attach files').setInputFiles({
      name: SINGLE_FAILED_FILE_NAME,
      mimeType: 'text/plain',
      buffer: Buffer.from('single failed attachment'),
    });

    await expect
      .poll(() => harness.uploadAttachmentRequestCalls.length)
      .toBe(1);
    expect(
      harness.uploadAttachmentRequestCalls[0]?.files.map(
        (file) => file.fileName,
      ),
    ).toEqual([SINGLE_FAILED_FILE_NAME]);
    expect(harness.uploadAttachmentCalls).toHaveLength(1);
    await expect(composer).not.toHaveValue(
      new RegExp(escapeRegExp(`![uploading ${SINGLE_FAILED_FILE_NAME}]()`)),
    );

    const screenshotDirectory = process.env.CONSOLE_E2E_SCREENSHOT_DIR;
    if (screenshotDirectory !== undefined) {
      await page.screenshot({
        path: path.join(screenshotDirectory, 'single-file-failure.png'),
        fullPage: false,
      });
    }

    await expect(
      page.getByText(/Operation failed: e2e single file upload failure reason/),
    ).toBeVisible();
  } finally {
    await harness.stop();
  }
});

test('keeps an upload running after navigating away and writes the link into the original task', async ({
  page,
}) => {
  const harness = await startConsoleE2eHarness({
    holdUploadAttachment: true,
  });

  try {
    await openFixtureItem(page, harness);

    const composerToggle = page.locator('.console-composer-toggle');
    const composer = page.locator('.console-composer-input');
    if ((await composer.count()) === 0) {
      await composerToggle.click();
    }
    await expect(composer).toBeVisible();

    await page.getByLabel('Attach files').setInputFiles({
      name: NAVIGATION_FILE_NAME,
      mimeType: 'image/png',
      buffer: Buffer.from('navigation attachment'),
    });
    await expect
      .poll(() => harness.uploadAttachmentRequestCalls.length)
      .toBe(1);

    await tabByLabel(page, 'Awaiting Owner').click();
    await itemRowByText(
      page,
      'Serve the committed console UI bundle from serveConsole',
    ).click();

    harness.releaseUploadAttachment();

    await tabByLabel(page, 'Workflow Blocker').click();
    await itemRowByText(page, ITEM_TITLE).click();
    const originalComposer = page.locator('.console-composer-input');
    if ((await originalComposer.count()) === 0) {
      await page.locator('.console-composer-toggle').click();
    }
    await expect(originalComposer).toBeVisible();
    await expect(originalComposer).toHaveValue(
      new RegExp(escapeRegExp(NAVIGATION_MARKDOWN)),
    );

    const screenshotDirectory = process.env.CONSOLE_E2E_SCREENSHOT_DIR;
    if (screenshotDirectory !== undefined) {
      await page.screenshot({
        path: path.join(screenshotDirectory, 'navigate-back-after-upload.png'),
        fullPage: false,
      });
    }
    await expect(originalComposer).not.toHaveValue(
      new RegExp(escapeRegExp(`![uploading ${NAVIGATION_FILE_NAME}]()`)),
    );
  } finally {
    harness.releaseUploadAttachment();
    await harness.stop();
  }
});

test('keeps text typed after returning to the task during an upload', async ({
  page,
}) => {
  const harness = await startConsoleE2eHarness({
    holdUploadAttachment: true,
  });

  try {
    await openFixtureItem(page, harness);

    const composerToggle = page.locator('.console-composer-toggle');
    const composer = page.locator('.console-composer-input');
    if ((await composer.count()) === 0) {
      await composerToggle.click();
    }
    await expect(composer).toBeVisible();

    await page.getByLabel('Attach files').setInputFiles({
      name: NAVIGATION_FILE_NAME,
      mimeType: 'image/png',
      buffer: Buffer.from('navigation attachment'),
    });
    await expect
      .poll(() => harness.uploadAttachmentRequestCalls.length)
      .toBe(1);

    await tabByLabel(page, 'Awaiting Owner').click();
    await itemRowByText(
      page,
      'Serve the committed console UI bundle from serveConsole',
    ).click();
    await tabByLabel(page, 'Workflow Blocker').click();
    await itemRowByText(page, ITEM_TITLE).click();
    const originalComposer = page.locator('.console-composer-input');
    if ((await originalComposer.count()) === 0) {
      await page.locator('.console-composer-toggle').click();
    }
    await expect(originalComposer).toBeVisible();
    await originalComposer.pressSequentially('typed while uploading');

    harness.releaseUploadAttachment();

    await expect(originalComposer).toHaveValue(
      new RegExp(
        `${escapeRegExp(NAVIGATION_MARKDOWN)}.*${escapeRegExp('typed while uploading')}`,
      ),
    );
    await expect(originalComposer).not.toHaveValue(
      new RegExp(escapeRegExp(`![uploading ${NAVIGATION_FILE_NAME}]()`)),
    );
  } finally {
    harness.releaseUploadAttachment();
    await harness.stop();
  }
});
