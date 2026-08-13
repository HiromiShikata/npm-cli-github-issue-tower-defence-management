#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
: "${DEFAULT_BRANCH:?DEFAULT_BRANCH is required}"
: "${VERIFIED_COMMIT_SHA:?VERIFIED_COMMIT_SHA is required}"

defaultBranchTipSha=$(git ls-remote origin "refs/heads/${DEFAULT_BRANCH}" | cut -f1)

if [ -z "${defaultBranchTipSha}" ]; then
  echo "::error::the tip of ${DEFAULT_BRANCH} could not be resolved from the remote"
  exit 1
fi

if [ "${defaultBranchTipSha}" = "${VERIFIED_COMMIT_SHA}" ]; then
  echo "releasable=true" >>"${GITHUB_OUTPUT}"
  echo "commit ${VERIFIED_COMMIT_SHA} is still the tip of ${DEFAULT_BRANCH}"
  exit 0
fi

echo "releasable=false" >>"${GITHUB_OUTPUT}"
echo "commit ${VERIFIED_COMMIT_SHA} is no longer the tip of ${DEFAULT_BRANCH}, which is now ${defaultBranchTipSha}, so no release is cut for it and the newer commit carries its changes forward"
exit 0
