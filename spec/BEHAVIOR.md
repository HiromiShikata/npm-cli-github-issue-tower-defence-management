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
- `Auto Status Check: STORY_UNSET_ESCALATED`

## Deduplicated: `Auto Status Check: STORY_UNSET` (fixed text within the 2-hour window)

- The `Auto Status Check: STORY_UNSET` interim notification's text no longer varies
  per dispatch: it does not embed an incrementing dispatch counter, so the text is
  identical for a given next-step agent across consecutive dispatches while the
  issue's story field stays unset.
- Because the text is fixed, the existing 2-hour comment-deduplication window
  (`isDuplicateWithinWindow` in `src/domain/services/commentDeduplication.ts`)
  catches it: a repeat dispatch within that window, while the story remains
  unset, does NOT post a new GitHub Issue comment.
- `Auto Status Check: STORY_UNSET_ESCALATED` is unaffected by this: it fires once,
  when the real (non-deduped) `STORY_UNSET` dispatch count reaches the
  dispatch-loop threshold, and always posts.
