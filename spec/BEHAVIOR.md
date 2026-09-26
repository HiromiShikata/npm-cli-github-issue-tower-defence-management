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

## Edited in place: `Auto Status Check: STORY_UNSET` (no comment-count growth)

- The `Auto Status Check: STORY_UNSET` interim notification is edited in place on
  every repeat dispatch instead of being posted as a new comment: GitHub's issue
  timeline never grows past one visible `STORY_UNSET` entry per issue while its
  story field stays unset, because an edit does not add a row to the timeline. The
  comment is matched by marker keyword alone, not by the next-step agent name it
  mentions, so this holds even when the computed next-step agent changes between
  consecutive dispatch cycles — the prior cycle's comment is still found and edited
  rather than left behind as a new one.
- The comment text still embeds its own dispatch counter (`(N/threshold)`), and
  that same counter is what `resolveNextStepAgentDispatchRepetition` reads back
  from the single existing comment's text to compute the next dispatch count —
  the count therefore still advances once per dispatch cycle, exactly as it did
  before comment editing was introduced, regardless of how much wall-clock time
  separates two dispatches.
- `Auto Status Check: STORY_UNSET_ESCALATED` is unaffected by this: it fires once,
  when that per-dispatch-cycle `STORY_UNSET` count reaches the dispatch-loop
  threshold, and always posts as a new comment.
