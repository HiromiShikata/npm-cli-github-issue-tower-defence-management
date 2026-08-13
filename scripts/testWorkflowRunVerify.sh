#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${TEST_WORKFLOW_FILE:?TEST_WORKFLOW_FILE is required}"
: "${VERIFIED_COMMIT_SHA:?VERIFIED_COMMIT_SHA is required}"
: "${REQUIRED_CONCLUSION:?REQUIRED_CONCLUSION is required}"
: "${POLL_INTERVAL_SECONDS:?POLL_INTERVAL_SECONDS is required}"
: "${POLL_TIMEOUT_SECONDS:?POLL_TIMEOUT_SECONDS is required}"

readonly latestRunOutcomeFilter='
  .workflow_runs
  | sort_by(.run_started_at, .id)
  | last
  | if . == null then "absent"
    elif .status != "completed" then "pending"
    else .conclusion end
'

latestRunOutcome() {
  gh api \
    "repos/${GITHUB_REPOSITORY}/actions/workflows/${TEST_WORKFLOW_FILE}/runs?head_sha=${VERIFIED_COMMIT_SHA}&per_page=100" \
    --jq "${latestRunOutcomeFilter}"
}

readonly waitDeadlineSeconds=$((SECONDS + POLL_TIMEOUT_SECONDS))

while :; do
  outcome=$(latestRunOutcome)
  case "${outcome}" in
  "${REQUIRED_CONCLUSION}")
    echo "${TEST_WORKFLOW_FILE} concluded ${outcome} for commit ${VERIFIED_COMMIT_SHA}"
    exit 0
    ;;
  absent | pending)
    if [ "${SECONDS}" -ge "${waitDeadlineSeconds}" ]; then
      echo "::error::${TEST_WORKFLOW_FILE} produced no ${REQUIRED_CONCLUSION} conclusion for commit ${VERIFIED_COMMIT_SHA} within ${POLL_TIMEOUT_SECONDS} seconds, last seen ${outcome}"
      exit 1
    fi
    sleep "${POLL_INTERVAL_SECONDS}"
    ;;
  *)
    echo "::error::${TEST_WORKFLOW_FILE} concluded ${outcome} for commit ${VERIFIED_COMMIT_SHA} instead of ${REQUIRED_CONCLUSION}"
    exit 1
    ;;
  esac
done
