import * as path from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import {
  type ConsoleE2eHarness,
  startConsoleE2eHarness,
} from './consoleTestHarness';

const CSP_VIOLATION_RECORD = 'consoleCspViolations';
const SAMPLE_VIDEO_PATH = path.join(__dirname, 'fixtures', 'csp-sample.webm');

const tabByLabel = (page: Page, label: string) =>
  page.locator('.console-tab', { hasText: label });

const itemRowByText = (page: Page, text: string) =>
  page.locator('.console-item-row', { hasText: text });

const GITHUB_IMAGE_URL =
  'https://github.com/user-attachments/assets/test-csp-image';
const GITHUB_VIDEO_URL =
  'https://github.com/user-attachments/assets/test-csp-video';
const EXTERNAL_IMAGE_URL = 'https://example.com/csp-external-diagram.png';
const EXTERNAL_VIDEO_URL = 'https://example.com/csp-external-demo.mp4';

const COMMENT_BODY = [
  `![Attachment image](${GITHUB_IMAGE_URL})`,
  '',
  `<video src="${GITHUB_VIDEO_URL}" controls></video>`,
  '',
  `[demo video](${GITHUB_VIDEO_URL})`,
  '',
  `![External diagram](${EXTERNAL_IMAGE_URL})`,
  '',
  `<video src="${EXTERNAL_VIDEO_URL}" controls></video>`,
  '',
  '```mermaid',
  'graph TD; A-->B;',
  '```',
].join('\n');

let harness: ConsoleE2eHarness;

test.beforeAll(async () => {
  harness = await startConsoleE2eHarness({
    getIssueOrPullRequestComments: async () => [
      {
        id: 1,
        author: 'HiromiShikata',
        body: COMMENT_BODY,
        createdAt: new Date('2026-09-06T12:00:00.000Z'),
      },
    ],
  });
});

test.afterAll(async () => {
  if (harness !== undefined) {
    await harness.stop();
  }
});

const openCommentWithContent = async (page: Page): Promise<void> => {
  await page.addInitScript((recordKey: string) => {
    const violations: string[] = [];
    (window as unknown as Record<string, unknown>)[recordKey] = violations;
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  }, CSP_VIOLATION_RECORD);
  await page.goto(harness.appRootUrl);
  await tabByLabel(page, 'Workflow Blocker').click();
  await itemRowByText(
    page,
    'Resolve the shared GitHub token rate-limit exhaustion blocker',
  ).click();
  await expect(page.locator('.console-comment')).toBeVisible();
  await page.locator('.console-comment').click();
  await expect(page.locator('.console-comment-body-expanded')).toBeVisible();
};

const readCspViolations = async (page: Page): Promise<string[]> => {
  const violations: string[] = [];
  for (const frame of page.frames()) {
    violations.push(
      ...(await frame.evaluate(
        (recordKey: string) =>
          (window as unknown as Record<string, string[]>)[recordKey] ?? [],
        CSP_VIOLATION_RECORD,
      )),
    );
  }
  return violations;
};

test.describe('console content security policy', () => {
  test('renders a GitHub image through the proxy and a non-GitHub image as a link without CSP violations', async ({
    page,
  }) => {
    await openCommentWithContent(page);
    const body = page.locator('.console-comment-body-expanded');

    const proxiedImage = body.locator(`img[src^="/api/img?url="]`);
    await expect(proxiedImage).toHaveCount(1);
    await expect(proxiedImage).toHaveAttribute(
      'src',
      new RegExp(
        encodeURIComponent(GITHUB_IMAGE_URL).replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&',
        ),
      ),
    );

    const externalLink = body.locator(`a[href="${EXTERNAL_IMAGE_URL}"]`);
    await expect(externalLink).toHaveCount(1);
    await expect(body.locator(`img[src="${EXTERNAL_IMAGE_URL}"]`)).toHaveCount(
      0,
    );

    const externalVideo = body.locator(`a[href="${EXTERNAL_VIDEO_URL}"]`);
    await expect(externalVideo).toHaveCount(1);
    await expect(
      body.locator(`video[src="${EXTERNAL_VIDEO_URL}"]`),
    ).toHaveCount(0);

    expect(await readCspViolations(page)).toEqual([]);
  });

  test('keeps a GitHub-hosted video playable', async ({ page }) => {
    await page.route(GITHUB_VIDEO_URL, (route) =>
      route.fulfill({ path: SAMPLE_VIDEO_PATH, contentType: 'video/webm' }),
    );
    await openCommentWithContent(page);
    const body = page.locator('.console-comment-body-expanded');
    const video = body.locator(`video[src="${GITHUB_VIDEO_URL}"]`);
    await expect(video).toHaveCount(1);
    await expect
      .poll(() =>
        video.evaluate((element: HTMLVideoElement) => element.readyState),
      )
      .toBeGreaterThanOrEqual(1);
    expect(await readCspViolations(page)).toEqual([]);
  });

  test('renders a Mermaid diagram in its frame without CSP violations', async ({
    page,
  }) => {
    await openCommentWithContent(page);
    const diagram = page.frameLocator('iframe[title="Mermaid diagram"]');
    await expect(diagram.locator('svg')).toBeVisible();
    expect(await readCspViolations(page)).toEqual([]);
  });
});
