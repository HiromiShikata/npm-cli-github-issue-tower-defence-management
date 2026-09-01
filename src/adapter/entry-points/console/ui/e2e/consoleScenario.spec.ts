import { expect, type Page, test } from '@playwright/test';
import {
  CONSOLE_E2E_AWAITING_QUALITY_CHECK_PR_URL,
  CONSOLE_E2E_REFERENCE_LINK_URL,
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

  await expect(title.getByText('Conflict')).toHaveCount(0);
  await expect(
    page.locator('.console-detail-topline').getByText('Conflict'),
  ).toBeVisible();

  const topline = page.locator('.console-detail-topline');
  await expect(topline.getByText('CI failing')).toBeVisible();
  await expect(topline.getByText(/missing: build, test/)).toBeVisible();
  await expect(topline.getByText('Out of date')).toBeVisible();

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
  await expect(tabBadge(page, 'Failed Preparation')).toHaveText('1');
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

  await expect(activeTabLabel(page)).toHaveText('Failed Preparation', {
    timeout: 8000,
  });
  await expect(tabByLabel(page, 'Awaiting Quality Check')).toHaveCount(0, {
    timeout: 8000,
  });

  await tabByLabel(page, 'Todo by human').click();
  await expect(activeTabLabel(page)).toHaveText('Todo by human');
  await expect(tabByLabel(page, 'Awaiting Quality Check')).toHaveCount(0);
  await expect(tabBadge(page, 'Todo by human')).toHaveText('1');

  await tabByLabel(page, 'Failed Preparation').click();
  await expect(activeTabLabel(page)).toHaveText('Failed Preparation');
  await expect(tabByLabel(page, 'Awaiting Quality Check')).toHaveCount(0);
  await expect(tabBadge(page, 'Failed Preparation')).toHaveText('1');
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
    page.locator('.console-op-button', { hasText: /^Awaiting Workspace$/ }),
  ).toBeVisible();
  await expect(
    page.locator('.console-op-button', { hasText: 'Close as not planned' }),
  ).toBeVisible();
  await expect(
    page.locator('.console-op-button', { hasText: '+1 hour' }),
  ).toBeVisible();
  await expect(
    page.locator('.console-op-button', { hasText: '+3 hours' }),
  ).toBeVisible();
  await expect(
    page.locator('.console-op-button', { hasText: '+1 day' }),
  ).toBeVisible();
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

  const openPullRequestLink = prHeader.getByRole('link', { name: 'open' });
  await expect(openPullRequestLink).toBeVisible();
  await expect(openPullRequestLink).toHaveAttribute(
    'href',
    /\/pull\/\d+(\/|$)/,
  );

  await prHeader.screenshot({
    path: '/tmp/after-related-pr-header.png',
  });
});

test('collects an inline comment on a related pull request diff without hover on a touch viewport, enabling Reject and submitting it as request-changes', async ({
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
      hasText: 'index.css',
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

  const rejectButton = page
    .locator('.console-op-button', { hasText: 'Reject' })
    .first();
  await expect(rejectButton).toBeDisabled();

  await commentButton.click();
  await page
    .locator('.console-diff-composer-input')
    .fill('Please verify this opacity change on touch devices.');
  await page.locator('.console-diff-composer-submit').click();

  await expect(page.locator('.console-diff-composer-posted')).toHaveText(
    'Comment saved.',
  );

  expect(harness.reviewCommentCalls).toHaveLength(0);

  await expect(rejectButton).toBeEnabled();
  await rejectButton.click();

  await expect
    .poll(() => harness.requestChangesCalls.length, { timeout: 10000 })
    .toBe(1);
  expect(harness.requestChangesCalls[0].url).toBe(
    'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/912',
  );
  expect(harness.requestChangesCalls[0].body).toContain(
    'Please verify this opacity change on touch devices.',
  );
  expect(harness.requestChangesCalls[0].body.length).toBeGreaterThan(0);

  await touchContext.close();
});

test('lists a still-open item and keeps its tab visible when the browser overlay marked it done before the served snapshot was generated', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await expect(tabByLabel(page, 'Todo by human')).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem(
      'pv_overlay_acme',
      JSON.stringify({
        PVTI_lADOABCD1234zgTODO00869: {
          done: true,
          ts: Date.parse('2026-06-18T00:30:00.000Z'),
          mode: 'todo-by-human',
        },
      }),
    );
  });
  await page.reload();
  await page.locator('.console-tabbar').screenshot({
    path: '/tmp/console-tabbar-after-regeneration.png',
  });

  await expect(tabByLabel(page, 'Todo by human')).toBeVisible();
  await expect(tabBadge(page, 'Todo by human')).toHaveText('1');

  await tabByLabel(page, 'Todo by human').click();
  await expect(
    itemRowByText(
      page,
      'Auto-advance to the next non-empty console tab when one empties',
    ),
  ).toBeVisible();
});

test('opens the comment input with the item detail, keeps it on screen while the item body scrolls, and gives the height back when it is closed', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await itemRowByText(
    page,
    'Resolve the shared GitHub token rate-limit exhaustion blocker',
  ).click();

  const composerToggle = page.locator('.console-composer-toggle');
  await expect(composerToggle).toBeInViewport();
  await expect(page.locator('.console-composer-input')).toBeInViewport();

  const dockBox = await page.locator('.console-detail-dock').boundingBox();
  const toggleBox = await composerToggle.boundingBox();
  if (dockBox === null || toggleBox === null) {
    throw new Error('the dock and its comment control must both be laid out');
  }
  expect(toggleBox.x).toBeGreaterThan(dockBox.x + dockBox.width / 2);
  expect(
    dockBox.x + dockBox.width - (toggleBox.x + toggleBox.width),
  ).toBeLessThan(32);

  await composerToggle.click();
  await expect(page.locator('.console-composer-input')).toHaveCount(0);
  await expect(composerToggle).toBeInViewport();

  await composerToggle.click();
  await expect(page.locator('.console-composer-input')).toBeInViewport();

  const dockHeightBeforePosting = (
    await page.locator('.console-detail-dock').boundingBox()
  )?.height;
  await page
    .locator('.console-composer-input')
    .fill('The dock must not grow with every comment.');
  await page.getByRole('button', { name: 'Comment', exact: true }).click();

  const postedComment = page.locator('.console-comment', {
    hasText: 'The dock must not grow with every comment.',
  });
  await expect(postedComment).toHaveCount(1);
  await expect(
    page.locator('.console-detail-dock .console-comment'),
  ).toHaveCount(0);
  await expect(page.locator('.console-comment-list')).toContainText(
    'The dock must not grow with every comment.',
  );
  const dockHeightAfterPosting = (
    await page.locator('.console-detail-dock').boundingBox()
  )?.height;
  expect(dockHeightAfterPosting).toBe(dockHeightBeforePosting);
});

test('renders the stories tab with non-gray stories, their open item counts, and an add-task button', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await tabByLabel(page, 'Stories').click();
  await expect(activeTabLabel(page)).toHaveText('Stories');

  const tdpmRow = page.locator('.console-story-list-row', {
    hasText: 'TDPM Console port',
  });
  await expect(tdpmRow.locator('.console-story-count')).toHaveText('4');
  await expect(
    tdpmRow.locator('.console-op-button', { hasText: 'Add task' }),
  ).toBeVisible();

  const tdpmLink = tdpmRow.locator('a.console-storytag');
  await expect(tdpmLink).toBeVisible();
  await expect(tdpmLink).toHaveAttribute(
    'href',
    'https://github.com/orgs/HiromiShikata/projects/6/views/1?sliceBy%5Bvalue%5D=TDPM%20Console%20port',
  );

  const publishRow = page.locator('.console-story-list-row', {
    hasText: 'Publish product documentation site',
  });
  await expect(publishRow.locator('.console-story-count')).toHaveText('1');
  await expect(publishRow.locator('a.console-storytag')).toHaveCount(0);
  await expect(publishRow.locator('span.console-storytag')).toBeVisible();

  await expect(
    page.locator('.console-story-list-row', {
      hasText: 'regular / workflow improvement',
    }),
  ).toHaveCount(0);
});

test('shows and hides gray stories with the Show archived toggle button on the stories tab', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await tabByLabel(page, 'Stories').click();
  await expect(activeTabLabel(page)).toHaveText('Stories');

  await expect(
    page.locator('.console-op-button', { hasText: 'Show archived' }),
  ).toBeVisible();

  await expect(
    page.locator('.console-story-list-row', {
      hasText: 'regular / workflow improvement',
    }),
  ).toHaveCount(0);

  await page
    .locator('.console-op-button', { hasText: 'Show archived' })
    .click();

  await expect(
    page.locator('.console-story-list-row', {
      hasText: 'regular / workflow improvement',
    }),
  ).toBeVisible();
  await expect(
    page.locator('.console-op-button', { hasText: 'Hide archived' }),
  ).toBeVisible();

  await page
    .locator('.console-op-button', { hasText: 'Hide archived' })
    .click();

  await expect(
    page.locator('.console-story-list-row', {
      hasText: 'regular / workflow improvement',
    }),
  ).toHaveCount(0);
  await expect(
    page.locator('.console-op-button', { hasText: 'Show archived' }),
  ).toBeVisible();
});

test('shows the agent label and value in the list row and the agent chip in the detail view', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await tabByLabel(page, 'Todo by agent').click();

  const agentItemRow = itemRowByText(
    page,
    'Route console items into the Todo by agent manual triage bucket',
  );
  await expect(
    agentItemRow.locator('.console-item-field-label', { hasText: 'Agent' }),
  ).toBeVisible();
  await expect(
    agentItemRow.locator('.console-item-field', { hasText: 'developer' }),
  ).toBeVisible();

  await agentItemRow.click();

  await expect(page.locator('.console-detail-agent-chip')).toBeVisible();
  await expect(page.locator('.console-detail-agent-chip')).toHaveText(
    'developer',
  );
});

test('creates an issue for a story when the add-task button and form are used', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await tabByLabel(page, 'Stories').click();

  const tdpmRow = page.locator('.console-story-list-row', {
    hasText: 'TDPM Console port',
  });
  await tdpmRow.locator('.console-op-button', { hasText: 'Add task' }).click();

  await page
    .locator('.console-inline-input-form-input')
    .fill('New task for TDPM Console port');
  await page
    .locator('.console-inline-input-form .console-op-button', {
      hasText: 'Create',
    })
    .click();

  await expect
    .poll(() => harness.createIssueCalls.length, { timeout: 10000 })
    .toBe(1);
  expect(harness.createIssueCalls[0].title).toBe(
    'New task for TDPM Console port',
  );
  expect(harness.createIssueCalls[0].org).toBe('HiromiShikata');
  expect(harness.createIssueCalls[0].repo).toBe(
    'npm-cli-github-issue-tower-defence-management',
  );
});

test('creates a new story when the add-story button and form are used', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await tabByLabel(page, 'Stories').click();

  await page
    .locator('.console-add-story-section .console-op-button', {
      hasText: 'Add story',
    })
    .click();

  await page
    .locator('.console-add-story-section .console-inline-input-form-input')
    .fill('My new story');
  await page
    .locator(
      '.console-add-story-section .console-inline-input-form .console-op-button',
      {
        hasText: 'Create',
      },
    )
    .click();

  await expect
    .poll(() => harness.addStoryCalls.length, { timeout: 10000 })
    .toBe(1);
  expect(harness.addStoryCalls[0].storyName).toBe('My new story');

  await expect(
    page.locator('.console-add-story-section .console-inline-input-form'),
  ).toHaveCount(0);
});

test('changes the color of a story row via the color palette in the stories tab', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await tabByLabel(page, 'Stories').click();

  const tdpmRow = page.locator('.console-story-list-row', {
    hasText: 'TDPM Console port',
  });
  await expect(tdpmRow).toBeVisible();

  const changeColorButton = tdpmRow.locator('.console-op-button', {
    hasText: 'Change color',
  });
  await expect(changeColorButton).toBeVisible();

  await changeColorButton.click();

  const palette = tdpmRow.locator('.console-story-color-palette');
  await expect(palette).toBeVisible();

  const swatches = palette.locator('.console-story-color-swatch');
  await expect(swatches).toHaveCount(8);

  const graySwatch = swatches.filter({ hasText: 'disable' });
  await expect(graySwatch).toHaveCount(1);

  const greenSwatch = palette.locator('[aria-label="GREEN"]');
  await greenSwatch.click();

  await expect
    .poll(() => harness.storyColorCalls.length, { timeout: 10000 })
    .toBe(1);
  expect(harness.storyColorCalls[0].storyOptionId).toBe('1491051e');
  expect(harness.storyColorCalls[0].newColor).toBe('GREEN');

  await expect(palette).toHaveCount(0);
});

test('shows queued items grouped by story with colored status badges and navigates to detail on row click', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await tabByLabel(page, 'Queued').click();
  await expect(activeTabLabel(page)).toHaveText('Queued');
  await expect(tabBadge(page, 'Queued')).toHaveText('2');

  const awaitingRow = itemRowByText(
    page,
    'Add telemetry to the TDPM cost dashboard',
  );
  const prepRow = itemRowByText(
    page,
    'Migrate the rate-limit store to a shared Redis backend',
  );
  await expect(awaitingRow).toBeVisible();
  await expect(prepRow).toBeVisible();

  const awaitingStatusBadge = awaitingRow
    .locator('.console-queued-item-badge')
    .first();
  await expect(awaitingStatusBadge).toHaveText('Awaiting Workspace');
  const awaitingStyle = await awaitingStatusBadge.getAttribute('style');
  expect(awaitingStyle).toContain('rgba(56, 139, 253');

  const prepStatusBadge = prepRow.locator('.console-queued-item-badge').first();
  await expect(prepStatusBadge).toHaveText('Preparation');
  const prepStyle = await prepStatusBadge.getAttribute('style');
  expect(prepStyle).toContain('rgba(187, 128, 9');

  const prepAgentBadge = prepRow.locator('.console-queued-item-badge').nth(1);
  await expect(prepAgentBadge).toHaveText('developer');

  await awaitingRow.click();
  await expect(page).toHaveURL(/PVTI_lADOABCD1234zgQUE00930/, {
    timeout: 3000,
  });
});

test('moves a prs-tab item to Awaiting Workspace via the list-level ok & Awaiting Workspace button without opening the detail view', async ({
  page,
}) => {
  await page.goto(harness.appUrl);

  await expect(activeTabLabel(page)).toHaveText('Awaiting Quality Check');

  const listLevelButton = page
    .locator('.console-list .console-op-button', {
      hasText: 'ok & Awaiting Workspace',
    })
    .first();
  await expect(listLevelButton).toBeVisible();

  await expect(page.locator('.console-detail')).toHaveCount(0);

  await listLevelButton.click();

  await expect
    .poll(
      () =>
        harness.commentCalls.some(
          (c) =>
            c.url === CONSOLE_E2E_AWAITING_QUALITY_CHECK_PR_URL &&
            c.body === 'ok',
        ),
      { timeout: 10000 },
    )
    .toBe(true);
});

test('posts a comment and moves the item to Awaiting Workspace when the Comment & Awaiting Workspace button is clicked', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await itemRowByText(
    page,
    'Resolve the shared GitHub token rate-limit exhaustion blocker',
  ).click();

  await expect(page.locator('.console-composer-input')).toBeInViewport();
  await page
    .locator('.console-composer-input')
    .fill('handing off to awaiting workspace');

  await page
    .getByRole('button', { name: 'Comment & Awaiting Workspace', exact: true })
    .click();

  await expect
    .poll(
      () =>
        harness.commentCalls.some(
          (c) => c.body === 'handing off to awaiting workspace',
        ),
      { timeout: 10000 },
    )
    .toBe(true);

  await expect(tabByLabel(page, 'Workflow Blocker')).toHaveCount(0, {
    timeout: 8000,
  });
});

test('posts an ok comment and moves the item to Awaiting Workspace when the ok & Awaiting Workspace button is clicked', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await itemRowByText(
    page,
    'Resolve the shared GitHub token rate-limit exhaustion blocker',
  ).click();

  await expect(page.locator('.console-composer-input')).toBeInViewport();

  await page
    .getByRole('button', { name: 'ok & Awaiting Workspace', exact: true })
    .click();

  await expect
    .poll(
      () =>
        harness.commentCalls.some(
          (c) =>
            c.url ===
              'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/720' &&
            c.body === 'ok',
        ),
      { timeout: 10000 },
    )
    .toBe(true);

  await expect(tabByLabel(page, 'Workflow Blocker')).toHaveCount(0, {
    timeout: 8000,
  });
});

test('project switcher appears at the left end of the tab bar and opens a dropdown on click', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  const nav = page.locator('nav.console-tabbar');
  const pjnameDiv = nav.locator('.console-tab-pjname');
  await expect(pjnameDiv).toBeVisible();

  const firstChild = nav.locator(':scope > *').first();
  await expect(firstChild).toHaveClass(/console-tab-pjname/);

  await expect(page.locator('.console-tab-pjname-dropdown')).toHaveCount(0);

  await pjnameDiv.locator('button').click();

  await expect(page.locator('.console-tab-pjname-dropdown')).toBeVisible();
});

test('deletes all comments when the dangerous actions panel is opened and the delete button is clicked', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await itemRowByText(
    page,
    'Resolve the shared GitHub token rate-limit exhaustion blocker',
  ).click();

  const dangerToggle = page.locator('.console-op-button', { hasText: '⚠' });
  await expect(dangerToggle).toBeVisible();

  await dangerToggle.click();

  const deleteButton = page.locator('.console-op-button', {
    hasText: 'Delete All Comments',
  });
  await expect(deleteButton).toBeVisible();

  await deleteButton.click();

  await expect(deleteButton).toHaveCount(0);

  await expect
    .poll(() => harness.deleteAllCommentsCalls.length, { timeout: 10000 })
    .toBe(1);

  expect(harness.deleteAllCommentsCalls[0].issueUrl).toContain('/issues/720');
});

test('shows the workflow improvement link when workflowImprovementIssueUrl is configured', async ({
  browser,
}) => {
  const workflowUrl =
    'https://github.com/HiromiShikata/umino-corporait-operation/issues/new?assignees=HiromiShikata';
  const localHarness = await startConsoleE2eHarness({
    workflowImprovementIssueUrl: workflowUrl,
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(localHarness.appRootUrl);
    const link = page.locator('.console-tab-workflow-improvement-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', workflowUrl);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noreferrer');
  } finally {
    await ctx.close();
    await localHarness.stop();
  }
});

test('does not show the workflow improvement link when workflowImprovementIssueUrl is not configured', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);
  await expect(
    page.locator('.console-tab-workflow-improvement-link'),
  ).toHaveCount(0);
});

test('renames a story option in the GitHub custom field via the rename form', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await tabByLabel(page, 'Stories').click();

  const tdpmRow = page.locator('.console-story-list-row', {
    hasText: 'TDPM Console port',
  });
  await expect(tdpmRow).toBeVisible();

  await tdpmRow.getByRole('button', { name: 'Rename story' }).click();

  const input = page.locator('.console-inline-input-form-input');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('TDPM Console port');

  await input.fill('TDPM Console port v2');
  await page
    .locator('.console-inline-input-form .console-op-button', {
      hasText: 'Rename',
    })
    .click();

  await expect
    .poll(() => harness.renameStoryCalls.length, { timeout: 10000 })
    .toBe(1);
  expect(harness.renameStoryCalls[0].storyOptionId).toBe('1491051e');
  expect(harness.renameStoryCalls[0].newName).toBe('TDPM Console port v2');

  await expect(tdpmRow.locator('.console-inline-input-form')).toHaveCount(0);
  await expect(
    page.locator('.console-story-list-row', {
      hasText: 'TDPM Console port v2',
    }),
  ).toBeVisible();
});

test('deletes a story option from the GitHub custom field when confirmed via the dialog', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await tabByLabel(page, 'Stories').click();

  const tdpmRow = page.locator('.console-story-list-row', {
    hasText: 'TDPM Console port',
  });
  await expect(tdpmRow).toBeVisible();

  const deleteButton = tdpmRow.getByRole('button', { name: 'Delete story' });
  await expect(deleteButton).toBeVisible();

  await deleteButton.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('TDPM Console port');

  await dialog.getByRole('button', { name: 'Delete' }).click();

  await expect
    .poll(() => harness.deleteStoryCalls.length, { timeout: 10000 })
    .toBe(1);
  expect(harness.deleteStoryCalls[0].storyOptionId).toBe('1491051e');

  await expect
    .poll(() => harness.closeIssueCalls.length, { timeout: 10000 })
    .toBe(1);
  expect(harness.closeIssueCalls[0]).toBe(
    'https://github.com/example/example/issues/1491051e',
  );

  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator('.console-story-list-row', { hasText: 'TDPM Console port' }),
  ).toHaveCount(0);
});

test('shows issue number after resolved title in reference links inside item body', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);

  await itemRowByText(
    page,
    'Resolve the shared GitHub token rate-limit exhaustion blocker',
  ).click();

  const referenceNumber = page.locator('.console-markdown-reference-number');
  await expect(referenceNumber).toBeVisible();
  const urlSegments = CONSOLE_E2E_REFERENCE_LINK_URL.split('/');
  const expectedNumber = `#${urlSegments[urlSegments.length - 1]}`;
  await expect(referenceNumber).toHaveText(expectedNumber);
});

test('project timer bar shows remaining time when active and Move to next project when expired', async ({
  page,
}) => {
  await page.goto(harness.appRootUrl);
  await expect(page.locator('.console-project-timer-bar')).toHaveCount(0);

  harness.setProjectTimer(1800);
  try {
    await page.reload();
    await expect(page.locator('.console-project-timer-bar')).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();
    const label = page.locator('.console-project-timer-bar-label');
    const text = await label.textContent();
    expect(text).toMatch(/^\d{2}:\d{2}$/);

    harness.expireProjectTimer();
    await page.reload();
    await expect(page.locator('.console-project-timer-bar-label')).toHaveText(
      'Move to next project',
    );
  } finally {
    harness.clearProjectTimer();
  }
});
