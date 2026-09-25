#!/usr/bin/env bash
set -euo pipefail

readonly ASSERTION_PATTERN='(expect\(|\.toHaveBeenCalled|\.toBe\(|\.toEqual\(|\.toStrictEqual\(|\.toContain\(|\.toMatch\(|\.toBeNull\(|\.toBeUndefined\(|\.toBeTruthy\(|\.toBeFalsy\(|assert\.|\.resolves\.|\.rejects\.)'
readonly ACCEPTANCE_CRITERIA_PATTERN='##\s*(success\s+criteria|acceptance\s+criteria|受入基準|完了条件)'

get_diff() {
  if [ -n "${TEST_DIFF_CONTENT+x}" ]; then
    printf '%s' "${TEST_DIFF_CONTENT}"
    return
  fi
  git diff "origin/${GITHUB_BASE_REF:-main}...HEAD" -- \
    '*.test.ts' '*.test.tsx' '*.test.js' '*.test.jsx' \
    '*.spec.ts' '*.spec.tsx' '*.spec.js' '*.spec.jsx'
}

get_issue_body() {
  # Legacy simple test mode: TEST_DIFF_CONTENT set without TEST_PR_BODY bypasses all parsing.
  if [ -n "${TEST_DIFF_CONTENT+x}" ] && [ -z "${TEST_PR_BODY+x}" ]; then
    printf '%s' "${TEST_ISSUE_BODY:-}"
    return
  fi

  local pr_body
  if [ -n "${TEST_PR_BODY+x}" ]; then
    pr_body="${TEST_PR_BODY}"
  else
    local pr_number="${PR_NUMBER:-}"
    if [ -z "${pr_number}" ]; then
      printf ''
      return
    fi
    pr_body=$(gh api "repos/${GITHUB_REPOSITORY}/pulls/${pr_number}" --jq '.body // empty' 2>/dev/null || true)
  fi

  local pr_body_with_urls_normalized
  pr_body_with_urls_normalized=$(printf '%s' "${pr_body}" | sed -E 's@https://github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/(issues|pull)/([0-9]+)@\1#\3@g')

  local closing_ref
  closing_ref=$(printf '%s' "${pr_body_with_urls_normalized}" | grep -oiP '(?i)(close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+\K([A-Za-z0-9_.\-]+/[A-Za-z0-9_.\-]+#[0-9]+|#[0-9]+)' | head -1 || true)

  if [ -z "${closing_ref}" ]; then
    printf ''
    return
  fi

  local repo issue_number
  if [[ "${closing_ref}" == */* ]]; then
    repo=$(printf '%s' "${closing_ref}" | grep -oP '^[^#]+')
    issue_number=$(printf '%s' "${closing_ref}" | grep -oP '[0-9]+$')
  else
    repo="${GITHUB_REPOSITORY:-}"
    issue_number=$(printf '%s' "${closing_ref}" | grep -oP '[0-9]+$')
  fi

  if [ -n "${TEST_ISSUE_BODY+x}" ]; then
    printf '%s' "${TEST_ISSUE_BODY}"
    return
  fi

  gh api "repos/${repo}/issues/${issue_number}" --jq '.body // empty' 2>/dev/null || true
}

has_acceptance_criteria() {
  local body="$1"
  printf '%s' "${body}" | grep -qiP "${ACCEPTANCE_CRITERIA_PATTERN}"
}

main() {
  local diff
  diff=$(get_diff)

  local removed_assertions
  removed_assertions=$(printf '%s' "${diff}" | grep '^-' | grep -v '^---' | grep -iP "${ASSERTION_PATTERN}" || true)

  if [ -z "${removed_assertions}" ]; then
    echo "No assertion deletions detected. Check passed."
    exit 0
  fi

  echo "Detected deleted or weakened assertions in test files:"
  printf '%s\n' "${removed_assertions}"
  echo ""

  local issue_body
  issue_body=$(get_issue_body)

  if [ -z "${issue_body}" ]; then
    echo "ERROR: Test assertions were deleted but no linked closing issue was found or the issue body is empty."
    echo "To pass this check, either:"
    echo "1. Do not delete or weaken existing test assertions, OR"
    echo "2. Link the PR to an issue that contains acceptance criteria (## Success Criteria or ## Acceptance Criteria) stating the behavior change."
    exit 1
  fi

  if has_acceptance_criteria "${issue_body}"; then
    echo "Acceptance criteria found in the closing issue. Check passed."
    exit 0
  else
    echo "ERROR: Test assertions were deleted but the closing issue does not contain acceptance criteria."
    echo "The closing issue body must contain a '## Success Criteria', '## Acceptance Criteria', or '## 受入基準' section with numbered items stating the behavior change."
    exit 1
  fi
}

main
