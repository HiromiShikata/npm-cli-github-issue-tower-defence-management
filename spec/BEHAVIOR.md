# TDPM Notify Pipeline — Comment Posting Policy

This document defines which events in the `notifyFinishedIssuePreparation` pipeline
are permitted to post a GitHub Issue comment and which are prohibited.

## Permitted: GitHub Issue comment IS posted

- **Reactivation trigger field change**: when `nextActionDate` or `nextActionHour` is
  set on an issue as part of a status transition, a GitHub Issue comment IS posted.
  These field changes are not visible in the GitHub Issues UI, so the comment is
  required to inform the reader that the issue will be reactivated at a future time.

## Prohibited: GitHub Issue comment is NOT posted

The following events output their message to `console.log` instead of posting a
GitHub Issue comment:

- **Dependency Issue URL notification**: when an issue has dependent Issue URLs and
  is returned to Awaiting Workspace, the list of dependency URLs is written to
  `console.log`. No GitHub Issue comment is posted.

- **Transient failure deferral notification**: when `--deferPreparation` is used to
  defer an item due to a transient session failure, the stop reason is written to
  `console.log`. No GitHub Issue comment is posted.

## Always posted (state-tracking markers)

The following markers are always posted as GitHub Issue comments when applicable:

- `Auto Status Check: REJECTED`
- `Auto Status Check: DISPATCH_AGAIN`
