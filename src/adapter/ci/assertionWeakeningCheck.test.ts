import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');
const scriptPath = path.join(
  repositoryRoot,
  'scripts',
  'assertionWeakeningCheck.sh',
);

type CheckResult = {
  readonly exitStatus: number | null;
  readonly output: string;
};

const writeFakeGhExecutableRespondingByRepoIssuePath = (
  tmpDir: string,
  issueBodyByRepoIssuePath: Readonly<Record<string, string>>,
): void => {
  const caseBranches = Object.entries(issueBodyByRepoIssuePath)
    .map(([repoIssuePath, body], index) => {
      const bodyFilePath = path.join(tmpDir, `issue-body-${index}.txt`);
      fs.writeFileSync(bodyFilePath, body);
      return `  *"${repoIssuePath}"*) cat "${bodyFilePath}" ;;`;
    })
    .join('\n');
  const ghScriptContent = `#!/usr/bin/env bash
set -euo pipefail
args="$*"
case "\${args}" in
${caseBranches}
  *) printf '' ;;
esac
`;
  const ghPath = path.join(tmpDir, 'gh');
  fs.writeFileSync(ghPath, ghScriptContent);
  fs.chmodSync(ghPath, 0o755);
};

const runCheck = (options: {
  readonly diffContent: string;
  readonly issueBody?: string;
  readonly prBody?: string;
  readonly ghApiIssueBodyByRepoIssuePath?: Readonly<Record<string, string>>;
}): CheckResult => {
  const parentEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      parentEnv[key] = value;
    }
  }
  const env: Record<string, string> = {
    ...parentEnv,
    TEST_DIFF_CONTENT: options.diffContent,
  };
  if (options.issueBody !== undefined) {
    env['TEST_ISSUE_BODY'] = options.issueBody;
  }
  if (options.prBody !== undefined) {
    env['TEST_PR_BODY'] = options.prBody;
  }

  let fakeGhDir: string | undefined;
  if (options.ghApiIssueBodyByRepoIssuePath !== undefined) {
    fakeGhDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'assertion-weakening-check-fake-gh-'),
    );
    writeFakeGhExecutableRespondingByRepoIssuePath(
      fakeGhDir,
      options.ghApiIssueBodyByRepoIssuePath,
    );
    env['PATH'] = `${fakeGhDir}${path.delimiter}${env['PATH'] ?? ''}`;
  }

  try {
    const result = spawnSync('bash', [scriptPath], {
      encoding: 'utf8',
      env,
    });

    return {
      exitStatus: result.status,
      output: `${result.stdout}${result.stderr}`,
    };
  } finally {
    if (fakeGhDir !== undefined) {
      fs.rmSync(fakeGhDir, { recursive: true, force: true });
    }
  }
};

const diffWithDeletedAssertion = `diff --git a/src/example.test.ts b/src/example.test.ts
index abc..def 100644
--- a/src/example.test.ts
+++ b/src/example.test.ts
@@ -10,7 +10,6 @@ describe('example', () => {
   it('does something', () => {
     const result = doSomething();
-    expect(result).toBe('expected value');
+    expect(result).toBe('different value');
   });
 });
`;

const diffWithNoAssertionRemovals = `diff --git a/src/example.test.ts b/src/example.test.ts
index abc..def 100644
--- a/src/example.test.ts
+++ b/src/example.test.ts
@@ -1,4 +1,4 @@
-import { oldHelper } from './old-helper';
+import { newHelper } from './new-helper';

 describe('example', () => {
   it('works', () => {
`;

const diffWithDeletedTestFile = `diff --git a/src/someComponent.test.ts b/src/someComponent.test.ts
deleted file mode 100644
index abc..000 100644
--- a/src/someComponent.test.ts
+++ /dev/null
@@ -1,8 +0,0 @@
-describe('someComponent', () => {
-  it('renders correctly', () => {
-    const result = render();
-    expect(result).not.toBeNull();
-    expect(result.title).toBe('Expected Title');
-  });
-});
`;

const diffWithRemovedToHaveBeenCalledWith = `diff --git a/src/handler.test.ts b/src/handler.test.ts
index abc..def 100644
--- a/src/handler.test.ts
+++ b/src/handler.test.ts
@@ -20,7 +20,7 @@ describe('handler', () => {
   it('calls onRequestWorkflowIssueCreate with the comment when clicked', () => {
     const onRequestWorkflowIssueCreate = jest.fn();
     fireEvent.click(btn);
-    expect(onRequestWorkflowIssueCreate).toHaveBeenCalledWith(comment);
+    expect(onRequestWorkflowIssueCreate).toHaveBeenCalled();
   });
 });
`;

const issueBodyWithSuccessCriteria = `## Requirements

Some requirements here.

## Success Criteria

1. SC-1: The behavior changes in a specific way
2. SC-2: Another criterion
`;

const issueBodyWithAcceptanceCriteria = `## Background

Some background.

## Acceptance Criteria

1. The dialog opens when the button is clicked
2. The callback receives the expected parameters
`;

const issueBodyWithJapaneseReceiptCriteria = `## 要件

いくつかの要件。

## 受入基準

1. 画面が正しく表示される
2. コールバックが呼ばれる
`;

const issueBodyWithCompletionCondition = `## 背景

背景説明。

## 完了条件

1. テストが通る
`;

const issueBodyWithoutAcceptanceCriteria = `## Background

Some background.

## What to build

Build a feature that does something.
`;

describe('assertion weakening check script', () => {
  it('is executable so the CI workflow can invoke it directly', () => {
    expect(fs.statSync(scriptPath).mode & 0o111).not.toBe(0);
  });

  describe('when no assertions are removed', () => {
    it('passes when the diff contains only import changes in test files', () => {
      const result = runCheck({
        diffContent: diffWithNoAssertionRemovals,
        issueBody: issueBodyWithoutAcceptanceCriteria,
      });
      expect(result.exitStatus).toBe(0);
      expect(result.output).toContain('No assertion deletions detected');
    });

    it('passes when the diff is empty', () => {
      const result = runCheck({
        diffContent: '',
        issueBody: issueBodyWithoutAcceptanceCriteria,
      });
      expect(result.exitStatus).toBe(0);
    });
  });

  describe('when assertions are removed and acceptance criteria is present', () => {
    it('passes when the closing issue has ## Success Criteria section', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        issueBody: issueBodyWithSuccessCriteria,
      });
      expect(result.exitStatus).toBe(0);
      expect(result.output).toContain('Acceptance criteria found');
    });

    it('passes when the closing issue has ## Acceptance Criteria section', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        issueBody: issueBodyWithAcceptanceCriteria,
      });
      expect(result.exitStatus).toBe(0);
      expect(result.output).toContain('Acceptance criteria found');
    });

    it('passes when the closing issue has Japanese 受入基準 section', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        issueBody: issueBodyWithJapaneseReceiptCriteria,
      });
      expect(result.exitStatus).toBe(0);
      expect(result.output).toContain('Acceptance criteria found');
    });

    it('passes when the closing issue has 完了条件 section', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        issueBody: issueBodyWithCompletionCondition,
      });
      expect(result.exitStatus).toBe(0);
      expect(result.output).toContain('Acceptance criteria found');
    });

    it('passes when an entire test file is deleted and the issue has acceptance criteria', () => {
      const result = runCheck({
        diffContent: diffWithDeletedTestFile,
        issueBody: issueBodyWithSuccessCriteria,
      });
      expect(result.exitStatus).toBe(0);
      expect(result.output).toContain('Acceptance criteria found');
    });

    it('passes when toHaveBeenCalledWith assertion is weakened to toHaveBeenCalled and criteria exist', () => {
      const result = runCheck({
        diffContent: diffWithRemovedToHaveBeenCalledWith,
        issueBody: issueBodyWithSuccessCriteria,
      });
      expect(result.exitStatus).toBe(0);
    });
  });

  describe('when assertions are removed and acceptance criteria is absent', () => {
    it('fails when the closing issue body has no acceptance criteria section', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        issueBody: issueBodyWithoutAcceptanceCriteria,
      });
      expect(result.exitStatus).toBe(1);
      expect(result.output).toContain('acceptance criteria');
    });

    it('fails when no closing issue is linked in the PR', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
      });
      expect(result.exitStatus).toBe(1);
      expect(result.output).toContain('no linked closing issue');
    });

    it('fails when an entire test file is deleted and the issue lacks acceptance criteria', () => {
      const result = runCheck({
        diffContent: diffWithDeletedTestFile,
        issueBody: issueBodyWithoutAcceptanceCriteria,
      });
      expect(result.exitStatus).toBe(1);
      expect(result.output).toContain('acceptance criteria');
    });

    it('reports the deleted assertion lines in the failure output', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        issueBody: issueBodyWithoutAcceptanceCriteria,
      });
      expect(result.exitStatus).toBe(1);
      expect(result.output).toContain('expect(result)');
    });
  });

  describe('assertion pattern detection', () => {
    const cases: Array<{ assertion: string; description: string }> = [
      { assertion: '    expect(value).toBe(true);', description: 'toBe' },
      {
        assertion: '    expect(fn).toHaveBeenCalledWith(arg);',
        description: 'toHaveBeenCalledWith',
      },
      {
        assertion: '    expect(fn).toHaveBeenCalled();',
        description: 'toHaveBeenCalled',
      },
      {
        assertion: '    expect(value).toEqual({ key: "val" });',
        description: 'toEqual',
      },
      {
        assertion: '    expect(value).toStrictEqual(expected);',
        description: 'toStrictEqual',
      },
      {
        assertion: '    expect(arr).toContain(item);',
        description: 'toContain',
      },
      {
        assertion: '    expect(str).toMatch(/pattern/);',
        description: 'toMatch',
      },
      {
        assertion: '    expect(value).toBeNull();',
        description: 'toBeNull',
      },
      {
        assertion: '    expect(value).resolves.toBe(true);',
        description: 'resolves',
      },
      {
        assertion: '    expect(fn).rejects.toThrow();',
        description: 'rejects',
      },
      {
        assertion: '    expect(value).toBeUndefined();',
        description: 'toBeUndefined',
      },
      {
        assertion: '    expect(value).toBeTruthy();',
        description: 'toBeTruthy',
      },
      {
        assertion: '    expect(value).toBeFalsy();',
        description: 'toBeFalsy',
      },
      {
        assertion: '    assert.strictEqual(result, expected);',
        description: 'assert.',
      },
    ];

    it.each(cases)(
      'detects removal of $description assertion and fails without criteria',
      ({ assertion }) => {
        const diff = `diff --git a/src/sample.test.ts b/src/sample.test.ts
index abc..def 100644
--- a/src/sample.test.ts
+++ b/src/sample.test.ts
@@ -1,5 +1,4 @@
 describe('sample', () => {
   it('test', () => {
-${assertion}
   });
 });
`;
        const result = runCheck({
          diffContent: diff,
          issueBody: issueBodyWithoutAcceptanceCriteria,
        });
        expect(result.exitStatus).toBe(1);
      },
    );
  });

  describe('closing reference parsing via TEST_PR_BODY injection', () => {
    it('passes when the PR body has a cross-repo closing ref and the issue has criteria', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        prBody:
          'This PR changes behavior.\n\nCloses HiromiShikata/secretary#7041',
        issueBody: issueBodyWithSuccessCriteria,
      });
      expect(result.exitStatus).toBe(0);
      expect(result.output).toContain('Acceptance criteria found');
    });

    it('fails when the PR body has a cross-repo closing ref but the issue lacks criteria', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        prBody: 'Closes HiromiShikata/secretary#7041',
        issueBody: issueBodyWithoutAcceptanceCriteria,
      });
      expect(result.exitStatus).toBe(1);
      expect(result.output).toContain(
        'the closing issue does not contain acceptance criteria',
      );
      expect(result.output).not.toContain('no linked closing issue');
    });

    it('passes when the PR body has a same-repo closing ref and the issue has criteria', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        prBody: 'Closes #100',
        issueBody: issueBodyWithSuccessCriteria,
      });
      expect(result.exitStatus).toBe(0);
    });

    it('fails when the PR body contains no closing reference', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        prBody: 'This PR updates some test assertions for performance reasons.',
      });
      expect(result.exitStatus).toBe(1);
      expect(result.output).toContain('no linked closing issue');
    });

    it('uses the first closing reference when multiple are present and the first lacks criteria', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        prBody:
          'Closes HiromiShikata/secretary#1\nCloses HiromiShikata/secretary#2',
        issueBody: issueBodyWithoutAcceptanceCriteria,
      });
      expect(result.exitStatus).toBe(1);
    });

    it('uses the first closing reference when multiple full-URL closing references are present and the first lacks criteria', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        prBody:
          'Closes https://github.com/owner/repo/issues/1\nCloses https://github.com/owner/repo/issues/2',
        ghApiIssueBodyByRepoIssuePath: {
          'repos/owner/repo/issues/1': issueBodyWithoutAcceptanceCriteria,
          'repos/owner/repo/issues/2': issueBodyWithSuccessCriteria,
        },
      });
      expect(result.exitStatus).toBe(1);
      expect(result.output).toContain(
        'the closing issue does not contain acceptance criteria',
      );
      expect(result.output).not.toContain('no linked closing issue');
    });

    it('uses the first closing reference when the PR body mixes a full-URL reference followed by a shorthand reference and the first lacks criteria', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        prBody:
          'Closes https://github.com/owner/repo/issues/1\nCloses owner/repo#2',
        ghApiIssueBodyByRepoIssuePath: {
          'repos/owner/repo/issues/1': issueBodyWithoutAcceptanceCriteria,
          'repos/owner/repo/issues/2': issueBodyWithSuccessCriteria,
        },
      });
      expect(result.exitStatus).toBe(1);
      expect(result.output).toContain(
        'the closing issue does not contain acceptance criteria',
      );
      expect(result.output).not.toContain('no linked closing issue');
    });

    it('passes when the PR body has a full-URL closing reference and the issue has criteria', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        prBody:
          'Closes https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/2627',
        issueBody: issueBodyWithSuccessCriteria,
      });
      expect(result.exitStatus).toBe(0);
      expect(result.output).toContain('Acceptance criteria found');
    });

    it('fails when the PR body has a full-URL closing reference but the issue lacks criteria', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        prBody:
          'Closes https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/2627',
        issueBody: issueBodyWithoutAcceptanceCriteria,
      });
      expect(result.exitStatus).toBe(1);
      expect(result.output).toContain(
        'the closing issue does not contain acceptance criteria',
      );
      expect(result.output).not.toContain('no linked closing issue');
    });

    it('passes when the PR body has a full-URL pull request closing reference and the issue has criteria', () => {
      const result = runCheck({
        diffContent: diffWithDeletedAssertion,
        prBody: 'Fixes https://github.com/HiromiShikata/secretary/pull/7041',
        issueBody: issueBodyWithAcceptanceCriteria,
      });
      expect(result.exitStatus).toBe(0);
      expect(result.output).toContain('Acceptance criteria found');
    });
  });

  describe('closing reference URL carrying a trailing fragment or query string', () => {
    const cases: Array<{
      description: string;
      urlSuffix: string;
      issueBody: string;
      expectedExitStatus: number;
      expectedOutputSubstring: string;
    }> = [
      {
        description: 'trailing #issuecomment fragment, issue has criteria',
        urlSuffix: '#issuecomment-1',
        issueBody: issueBodyWithSuccessCriteria,
        expectedExitStatus: 0,
        expectedOutputSubstring: 'Acceptance criteria found',
      },
      {
        description: 'trailing #issuecomment fragment, issue lacks criteria',
        urlSuffix: '#issuecomment-1',
        issueBody: issueBodyWithoutAcceptanceCriteria,
        expectedExitStatus: 1,
        expectedOutputSubstring:
          'the closing issue does not contain acceptance criteria',
      },
      {
        description: 'trailing ?query string, issue has criteria',
        urlSuffix: '?query=1',
        issueBody: issueBodyWithSuccessCriteria,
        expectedExitStatus: 0,
        expectedOutputSubstring: 'Acceptance criteria found',
      },
      {
        description: 'trailing ?query string, issue lacks criteria',
        urlSuffix: '?query=1',
        issueBody: issueBodyWithoutAcceptanceCriteria,
        expectedExitStatus: 1,
        expectedOutputSubstring:
          'the closing issue does not contain acceptance criteria',
      },
    ];

    it.each(cases)(
      'resolves a valid {owner}/{repo}#{N} reference for $description',
      ({
        urlSuffix,
        issueBody,
        expectedExitStatus,
        expectedOutputSubstring,
      }) => {
        const result = runCheck({
          diffContent: diffWithDeletedAssertion,
          prBody: `Closes https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/2627${urlSuffix}`,
          issueBody,
        });
        expect(result.exitStatus).toBe(expectedExitStatus);
        expect(result.output).toContain(expectedOutputSubstring);
      },
    );
  });
});
