#!/usr/bin/env bash
set -euo pipefail

readonly PR_NUMBER_PATTERN='^[0-9]*$'

main() {
  local value="${1:-}"

  if [[ "${value}" =~ ${PR_NUMBER_PATTERN} ]]; then
    printf '%s' "${value}"
  else
    printf ''
  fi
}

main "$@"
