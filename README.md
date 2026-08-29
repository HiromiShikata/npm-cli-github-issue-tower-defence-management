# npm-cli-github-issue-tower-defence-management

[![Test](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/actions/workflows/test.yml/badge.svg)](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/actions/workflows/test.yml)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

Welcome to npm-cli-github-issue-tower-defence-management :tada:

## Usage 🛠️

Here's how you can use github-issue-tower-defence-management:

```
Usage: github-issue-tower-defence-management [command] [options]

CLI tool for GitHub Issue Tower Defence Management

Commands:
  schedule [options]                    Handle scheduled events (trigger: issue or schedule) (default)
  startDaemon [options]                 Start daemon to prepare GitHub issues
  notifyFinishedIssuePreparation [options]  Notify that issue preparation is finished
  checkIssueReviewReadiness [options]   Check whether an issue is review-ready (read-only; does not change Status or post any comment)
  serveWeb [options]                    Start the local TDPM web server (console tabs, dashboard, and in-tmux session list)
  serveConsole [options]                Deprecated alias for serveWeb. Use serveWeb instead.
  selectOauthToken [options]            Print one rate-limit-aware Claude Code OAuth token to stdout (pipeable; read-only)
  selectLiveSessionOauthToken [options] Print one Claude Code OAuth token chosen for a new live interactive session (soonest 7d reset among tokens under their concurrent session limit; read-only)
  countInTmuxByHumanSessionsPerToken [options]  Print, per OAuth token, the count of live "In Tmux by human" interactive sessions using that token (read-only)
  killTmuxSession [options]             Cleanly kill a tmux session by running tmux kill-session and stopping its cl-*.scope systemd --user unit
  attachOrCreate [options]              Attach to an existing registered tmux session for the issue URL, or create a new one
  ownerCallFileAppend [options]         Append one owner call to the per-session owner call file (writes nothing to stdout)
  ownerCallFileDelete [options]         Delete the per-session owner call file (writes nothing to stdout; an already absent file is not an error)
  help [command]                        display help for command

Options for schedule:
  -t, --trigger <type>          Trigger type: issue or schedule
  -c, --config <path>           Path to config YAML file
  -v, --verbose                 Verbose output
  -i, --issue <url>             GitHub Issue URL
  --inTmuxProjectOrder <names>  Comma-separated project names, in display order, for the in-tmux-by-human session list. When omitted, falls back to the inTmuxProjectOrder value in the config file.

Options for startDaemon:
  --configFilePath <path>                          Path to config file for tower defence management (required)
  --projectUrl <url>                               GitHub project URL
  --manager <login>                                GitHub login of the manager; only Awaiting Workspace issues assigned to this login are picked up (required)
  --defaultAgentName <name>                        Default agent name
  --defaultLlmModelName <name>                     Default LLM model name
  --fallbackLlmModelName <name>                    LLM model a token falls back to when the default Sonnet model's 7-day weekly limit is exhausted for that token while its fallback weekly window still has capacity; routing is decided per token, so tokens with Sonnet headroom keep using Sonnet in the same pass (default: claude-opus-4-8)
  --defaultLlmAgentName <name>                     Default LLM agent name
  --maximumPreparingIssuesCount <count>            Maximum number of issues in preparation status (default: 6 per available Claude OAuth token, otherwise 6)
  --utilizationPercentageThreshold <percent>       5-hour utilization hard threshold; tokens at or above this percentage are excluded from rotation. Per-token concurrency also tapers from 6 slots down to 1 as either the 5h or 7d utilization rises from 80% toward 100%, taking the more restrictive of the two (default: 90)
  --allowedIssueAuthors <authors>                  Comma-separated list of allowed issue authors
  --preparationProcessCheckCommand <template>      Shell command template with {URL} placeholder to check if a preparation process is alive
  --fleetConfigFilePath <path>                     Path to the fleet-wide YAML config file holding the preparationWorker mapping (normalConcurrentLimit); falls back to the TDPM_FLEET_CONFIG environment variable, and to the built-in values when neither is set

Options for notifyFinishedIssuePreparation:
  --configFilePath <path>                          Path to config file for tower defence management (required)
  --issueUrl <url>                                 GitHub issue URL (required)
  --projectUrl <url>                               GitHub project URL
  --thresholdForAutoReject <count>                 Threshold for auto-escalation after consecutive rejections (default: 3)
  --thresholdForDispatchLoop <count>               Threshold for auto-escalation after one agent is dispatched this many times since the last human comment, whether it names itself or two agents name each other in turn (default: 6)
  --workflowBlockerResolvedWebhookUrl <url>        Webhook URL to notify when a workflow blocker issue status changes
  --missingAgentName <name>                        Agent definition name that was not found; triggers task issue creation (assigned to the manager from config) and blocks the item until that issue is closed
  --sessionErrorLine <line>                        Exact error line from the session log to include in the task issue body
  --deferPreparation                               Defer the item via the Reactivation Trigger fields (sets nextActionDate to tomorrow) and return it to Awaiting Workspace without creating any issue, recording the value of --sessionErrorLine as the stop reason in the deferral comment; use for transient upstream failures that should retry the next day

Options for checkIssueReviewReadiness:
  --configFilePath <path>                          Path to config file for tower defence management (required)
  --issueUrl <url>                                 GitHub issue URL (required)
  --projectUrl <url>                               GitHub project URL

Options for serveWeb (and its deprecated alias serveConsole):
  --configFilePath <path>                          Path to config file for tower defence management (required)
  --port <number>                                  Port for the web HTTP server (default: 9980)
  --consoleDataOutputDir <path>                    Directory where console data files are written and served from
  --inTmuxDataDir <path>                           Directory containing the flat in-tmux-by-human static JSON files served at /in-tmux-by-human/*.json
  --dashboardDir <path>                            Directory containing the static dashboard HTML fragment tdpm.txt served at /tdpm.txt when compose mode is not active (default: the jsonpub directory)
  --dashboardDataDir <path>                        Directory containing the dashboard data files (projects/<projectName>.json, machine-status.json, token-status.json); when set and every required file is present the server composes the /tdpm.txt fragment from them, otherwise it falls back to serving the static tdpm.txt from --dashboardDir (unset when not configured)
  --dashboardProjectNames <names>                  Comma-separated project names, in display order, for the dashboard project grid; the display label of each project is its first 2 characters, which must be unique across the listed names

Options for selectOauthToken:
  --tokenListJsonPath <path>                       Path to the JSON array of { name, token, selectionWeight? } records; selectionWeight is an optional positive number (default 1) that biases how often a token is chosen among eligible candidates (falls back to the CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH environment variable)
  --cacheDir <path>                                Directory holding per-token rate-limit cache files (falls back to the TDPM_RATELIMIT_CACHE_DIR environment variable, then to ${XDG_CACHE_HOME:-~/.cache}/tdpm/ratelimit)

Options for selectLiveSessionOauthToken:
  --tokenListJsonPath <path>                       Path to the JSON array of { name, token, selectionWeight? } records; selectionWeight is an optional positive number (default 1) that scales this token concurrent live session limit; a smaller weight allows fewer simultaneous sessions and never bypasses eligibility filtering or starves a sole eligible token. Falls back to the CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH environment variable.
  --cacheDir <path>                                Directory holding per-token rate-limit cache files (falls back to the TDPM_RATELIMIT_CACHE_DIR environment variable, then to ${XDG_CACHE_HOME:-~/.cache}/tdpm/ratelimit)
  --fleetConfigFilePath <path>                     Path to the fleet-wide YAML config file holding the liveSessionOauthTokenSelection mapping (maxConcurrentSessionCount, fullSpeedFiveHourFreeRatio); falls back to the TDPM_FLEET_CONFIG environment variable, and to the built-in values when neither is set

Options for countInTmuxByHumanSessionsPerToken:
  --configFilePath <path>                          Path to config file for tower defence management (required)
  --projectUrl <url>                               GitHub project URL
  --tokenListJsonPath <path>                       Path to the JSON array of { name, token } records (falls back to the claudeCodeOauthTokenListJsonPath config value, then to the CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH environment variable)

Options for killTmuxSession:
  --session <name>                                 Name of the tmux session to kill
  --self                                            Terminate the current session by stopping its own cl-*.scope systemd user unit, derived from /proc/self/cgroup

Options for attachOrCreate:
  --issueUrl <url>                                 GitHub issue URL to attach to or create a session for (required)

Options for ownerCallFileAppend:
  --session <name>                                 tmux session name that raised the call (required)
  --calledAt <timestamp>                           Time the call was raised, as UTC ISO-8601 with second precision and a trailing Z (required)
  --body-file <path>                               Path to the file holding the call body; the body is read from a file because it is multi-line and can be long (required)
  --inTmuxDataDir <path>                           Directory the owner call files are written under, the same directory serveWeb serves them from

Options for ownerCallFileDelete:
  --session <name>                                 tmux session name that raised the call (required)
  --inTmuxDataDir <path>                           Directory the owner call files are written under, the same directory serveWeb serves them from
```

The `serveWeb` sub-command starts a local HTTP server that serves the TDPM web surface — the console tabs, the dashboard, and the in-tmux-by-human session list. `serveConsole` remains available as a deprecated alias that maps to the same handler, so existing invokers keep working during rollout; new usage should prefer `serveWeb`. One running instance serves every project: the user opens a per-project URL path `/projects/{pjcode}` (or `/projects/{pjcode}/{workflow-blocker|prs|triage|unread|failed-preparation|todo-by-human|todo-by-agent}`) and the bundled UI reads the `pjcode` from its own URL path and loads that project's list data. The server serves the bundled single-page-application `index.html` at `/`, `/index.html`, and every `/projects/{pjcode}` and `/projects/{pjcode}/{tab}` app route. Every response is sent with `Cache-Control: no-store`. Any request path containing a segment that begins with a dot (for example `/.git` or `/.env`) is rejected with HTTP 404. The UI bootstrap assets (HTML and JS) are served without authentication; served `*.json` files and `/api/*` paths require an access token supplied either as the `k` query parameter (`?k=<token>`) or the `X-PV-Token` request header. The access token is read from the `consoleAccessToken` config value and never appears on the command line. When the built UI bundle directory (`ui-dist`) is absent the server still starts and serves a minimal placeholder index for `/`, `/index.html`, and the per-project app routes.

The dashboard fragment is served unauthenticated at `GET /tdpm.txt` as `text/html`. Compose mode is opt-in: when `--dashboardDataDir` is set and every required data file is present (`machine-status.json`, `token-status.json`, and a `projects/<projectName>.json` for every name in `--dashboardProjectNames`), the server composes the fragment at request time from those files emitted by the scheduled run — one `projects/<projectName>.json` per project, keyed by the full project name (the same key the scheduled run writes; that project's actionable status counts), `machine-status.json` (mem%, cpu%, disk%, loadavg, cycle-minutes), and `token-status.json` (per-token rate-limit utilization, reset countdown, status color, and prep/hum counts). It renders the fixed-width fragment — the two host-metrics lines (line 1 `M{mem}% C{cpu}% D{disk}% cy{cycle}`, line 2 `LA {load1} {load5} {load15}`), the project grid (header then one row per name in `--dashboardProjectNames` order, labelled with the project's two-character display code derived from its name and prefixed with its severity dot), a blank separator line, then one row per token sorted by soonest seven-day reset — wrapped in `<tt>…</tt><br>` with spaces encoded as `&nbsp;`. Otherwise — when `--dashboardDataDir` is unset, or it is set but any required data file is missing — the server falls back to serving the static `tdpm.txt` byte-for-byte from `--dashboardDir`, exactly as before compose mode existed. The route returns HTTP 404 only when neither source is available (compose mode inactive and no static `tdpm.txt` present). Only `GET` is accepted on this path.

Behind the token gate the server exposes three groups of routes:

- Data delivery (GET): `GET /projects/{pjcode}/{workflow-blocker|prs|triage|unread|failed-preparation|todo-by-human|todo-by-agent}/list.json` and the matching `detail/<key>.json` files are read from `{consoleDataOutputDir}/{pjcode}/{tab}/`, and `GET /projects/{pjcode}/in-tmux-by-human/*` is read from `{consoleDataOutputDir}/{pjcode}/in-tmux-by-human/`. Each served list has the `.done` cross-tab exclusion applied. The schedule cycle writes the full tab files; `notifyFinishedIssuePreparation` additionally patches the affected tab files immediately after each status transition.
- Flat in-tmux-by-human static files (GET): `GET /in-tmux-by-human/<file>.json` serves the flat static JSON files (for example `index.v4.json` and `{project}.v4.json`, plus the v3 files for backward compatibility) byte-for-byte from `--inTmuxDataDir`. Only flat file names directly under that directory are served; any other nested path and any path traversal attempt are rejected with HTTP 404. This route is distinct from the per-project `/projects/{pjcode}/in-tmux-by-human/*` data-delivery route above. These files are still gated by the same access token, so requests carry `?k=<token>`. The token-keyed file generation is performed by an external watcher, not by this server.
- Per-session owner call files (GET and DELETE): `GET /in-tmux-by-human/call-to-user/{pjcode or NA}/{session}.yaml` serves the owner call file of exactly one session byte-for-byte from `--inTmuxDataDir`, as `text/yaml`, and `DELETE` on the same path removes it and answers HTTP 204 whether or not the file was still there, so a client that deletes twice is not in error. Only this one-directory-deep shape is accepted; `DELETE` is refused with HTTP 404 on every other path under the prefix, including the flat JSON files. Both methods sit behind the same access token as every other served file. There is no route that returns several sessions at once: a client derives one path from one session name and fetches that.
- Read APIs (GET, backed by the server-side `GH_TOKEN`): `GET /api/itembody`, `GET /api/comments`, `GET /api/prfiles`, `GET /api/prcommits`, `GET /api/relatedprs`, and `GET /api/issuetitle`. Each takes a `url` query parameter. `GET /api/issuetitle` returns `{ state, merged, isPullRequest, title }`, where `title` comes from the pull request summary for pull request URLs and from the issue for issue URLs; it is served through an in-process cache: a merged result is cached permanently and every other result is re-fetched after 300 seconds. The console UI uses this endpoint both for the opened item header and to decorate full PR/issue URL links inside rendered markdown with their open/closed/merged state icon and title.
- Operation APIs (POST, JSON body): `POST /api/review` (`approve`, `request_changes`, `close`), `POST /api/triage` (`set_status`, `set_story`, `close`, `close_not_planned`, `snooze_1day`, `snooze_1week`), and `POST /api/intmux` (`set_intmux`). These routes are multi-project: every request body carries the `pjcode` of the project the UI is currently viewing (taken from the UI's own `/projects/{pjcode}` URL path), the server resolves that `pjcode` to its GitHub Project URL through the `pjcode → projectUrl` mapping described below, loads that project's status and story options (lazily, cached per `pjcode`), and applies the operation against the resolved project. A request with no `pjcode`, or a `pjcode` that has no configured project URL, is rejected with HTTP 400. Each confirmed operation records the affected `projectItemId` into the `.done` exclusion under the resolved `pjcode` so it disappears from every tab's served list for that project only. One running `serveWeb` instance therefore serves both reads and writes for every configured project.
- Comment APIs (POST, JSON body, backed by the server-side `GH_TOKEN`): `POST /api/comment` posts a top-level comment on the issue or pull request named by the request body's `url`. `POST /api/reviewcomment` posts a line-anchored inline review comment on a pull request diff; its request body carries `url` (the pull request URL), `path` (the changed file path), `line` (a positive integer diff line number), `side` (`RIGHT` for added or context lines on the new side, `LEFT` for removed lines on the old side), and `body`. The server resolves owner, repo, and pull request number from `url`, fetches the pull request head commit sha, and calls GitHub `POST /repos/{owner}/{repo}/pulls/{number}/comments` with `commit_id` set to that sha. When GitHub rejects the request, the response is HTTP 502 with the GitHub error message in the `error` field of the body so the UI can show the real reason.

The `.done` exclusion is persisted per tab in a `.done.json` file alongside each tab's `list.json` under `consoleDataOutputDir`. The file is never directly servable because the dot-segment block rejects any path containing it. It is an optimistic-hide store scoped to a single regeneration cycle: each confirmed operation records the affected `projectItemId` so the item disappears immediately, and the schedule cycle resets every tab's `.done.json` back to `{ "projectItemIds": [] }` right after it regenerates that project's `list.json` files. This bounds the store to at most one cycle of recorded ids, so it can never accumulate and over-hide items that legitimately re-enter a visible status.

Multi-project operation routing is configured through an optional `consoleProjects` mapping in the config file. It maps each `pjcode` to that project's GitHub Project URL so the operation APIs can resolve the correct project per request. The configured `projectName` is always added to this mapping automatically (pointing at the configured `projectUrl`), so a single-project deployment needs no `consoleProjects` entry at all. When the same `serveWeb` instance serves write operations for several projects, list each additional project explicitly:

```yaml
consoleAccessToken: '<console access token>'
projectUrl: 'https://github.com/orgs/my-org/projects/1'
projectName: 'my-project'
consoleProjects:
  my-project: 'https://github.com/orgs/my-org/projects/1'
  other-project: 'https://github.com/orgs/other-org/projects/2'
```

Each project's status and story options are loaded lazily the first time a `pjcode` is used and then cached for the life of the process, so the additional projects add no startup cost.

When the console serves multiple projects whose owners require distinct GitHub tokens, set `consoleGithubTokenFileDir` to a directory that contains per-project token files named `tdpm-github-token-{pjcode}.txt`. When a request arrives for a repository owner, `serveWeb` finds the `pjcode` whose project URL owner matches, then reads the token from the corresponding file in that directory. When `consoleGithubTokenFileDir` is absent or `null`, or when no pjcode maps to the owner, the fleet-wide `GH_TOKEN` is used as the fallback for that owner. This means you can add a file for the first owner that needs a distinct token and any remaining owners continue to use the default credential:

```yaml
consoleAccessToken: '<console access token>'
projectUrl: 'https://github.com/orgs/my-org/projects/1'
projectName: 'my-project'
consoleProjects:
  my-project: 'https://github.com/orgs/my-org/projects/1'
  other-project: 'https://github.com/orgs/other-org/projects/2'
consoleGithubTokenFileDir: '/path/to/token-files'
```

In the example above, a file `/path/to/token-files/tdpm-github-token-my-project.txt` provides the token for `my-org`; requests for `other-org` fall back to `GH_TOKEN`. Each token file must contain only the token string, with an optional trailing newline. An empty file throws an error rather than falling back silently. The fleet-wide `GH_TOKEN` is still required for the `startDaemon` preparation cycle; only the console HTTP server routes go through the per-project token files.

The optional `storyProgressCommentEnabled` config key controls the daily story progress comment. Once per day the schedule cycle posts a comment containing a mermaid `flowchart TD` of the story and its child issues onto every story issue. Setting the key to `false` stops that comment being posted for the project; the key defaults to `true`, so omitting it leaves the existing behaviour unchanged.

```yaml
storyProgressCommentEnabled: false
```

The `checkIssueReviewReadiness` sub-command lets an agent self-check whether an issue is currently review-ready. It does NOT change the issue Status field and does NOT post any comment. It writes a single JSON line to stdout of the shape `{ "reviewReady": boolean, "rejections": [{ "type": string, "detail": string }] }` and exits 0 on a successful evaluation regardless of readiness; a non-zero exit indicates an operational error (auth failure, network error). The rejection types include: `ISSUE_NOT_FOUND`, `NO_REPORT_FROM_AGENT_BOT`, `REPORT_HAS_NEXT_STEP`, `PULL_REQUEST_NOT_FOUND`, `PULL_REQUEST_IS_DRAFT`, `PULL_REQUEST_CONFLICTED`, `ANY_CI_JOB_FAILED_OR_IN_PROGRESS`, `REQUIRED_CI_JOB_NEVER_STARTED`, `ANY_REVIEW_COMMENT_NOT_RESOLVED`, and `MULTIPLE_PULL_REQUESTS_FOUND`. The `--projectUrl` option is optional; when omitted the command still runs using only the issue URL.

The `selectOauthToken` sub-command reads the same per-token rate-limit cache that the `startDaemon` proxy writes (see "Claude OAuth Token Rotation" below) and prints exactly one token string to stdout so a caller can choose an appropriate token before launching Claude Code. It is read-only: it never starts the proxy, never mutates any cache file, and never writes the token anywhere. Selection runs in two stages. First, a candidate filter keeps tokens whose 5-hour window is at least 60% free (5-hour utilization at most 0.40) AND whose 7-day window is at least 14% free (7-day utilization at most 0.86), where "% free" is `1 - utilization`. A token with no cache file, or whose window reset epoch has already passed, is treated as fully free (utilization 0) for these checks. The filter additionally excludes any token carrying a non-expired reactive `seven_day_fable` rejection marker — set when a `fable`-model request on that token was rejected with HTTP 429 (see "Claude OAuth Token Rotation" below) — because these interactive sessions run on the `fable` model; a token without the marker is treated as `fable`-usable, and the marker is ignored once its stored reset epoch has passed. Second, among the surviving candidates it selects the single token whose 7-day window reset epoch is nearest in the future (soonest reset), so weekly quota that would otherwise reset unused is consumed first; a candidate with no active 7-day window is treated as having the farthest reset (now + 7 days) and therefore sorts last. Each token entry may carry an optional `selectionWeight` (a positive number, default `1`); when the eligible candidates carry differing weights the selection among them becomes weighted-random by that weight, so a token with a smaller weight is chosen proportionally less often, while a token that is the only eligible candidate is always chosen regardless of its weight. When every eligible candidate shares the same weight (the default), the deterministic soonest-reset selection above is used unchanged. The selected token string is written to stdout (pipeable) and the per-candidate decision trace is written to stderr. When no token passes the filter, nothing is written to stdout and the command exits non-zero with an explanatory message on stderr. The token-list path comes from `--tokenListJsonPath` or the `CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH` environment variable; the cache directory comes from `--cacheDir` or the `TDPM_RATELIMIT_CACHE_DIR` environment variable, defaulting to `${XDG_CACHE_HOME:-~/.cache}/tdpm/ratelimit`.

The `selectLiveSessionOauthToken` sub-command picks a token for a new live interactive Claude Code session a human is about to start, so that concurrent interactive sessions spread across distinct tokens instead of stacking onto the same one. It loads the token list and reads the same per-token rate-limit cache as `selectOauthToken`, and it is read-only in exactly the same way: it never starts the proxy, never mutates any cache file, and never writes the token anywhere. It applies a base rate-limit eligibility filter (5-hour window at least 25% free AND 7-day window at least 3% free, with a missing cache file or an expired window treated as fully free, and any token carrying a non-expired reactive `seven_day_fable` rejection marker excluded), and additionally excludes any token whose 5-hour window is less than `minFiveHourFreeRatio` (default 60%) free or whose 7-day window is less than `minSevenDayFreeRatio` (default 14%) free; these stricter thresholds prevent the `cl` script from starting a new interactive session on a token that is nearly exhausted. It additionally measures current live occupancy per token by scanning running Claude Code processes on the local Linux host: for each process under `/proc` it reads the NUL-separated `/proc/<pid>/environ` and, when the process is a Claude Code process, takes its `CLAUDE_CODE_OAUTH_TOKEN` and `CLAUDE_CODE_SESSION_ID`. A token's occupancy is the number of distinct `CLAUDE_CODE_SESSION_ID` values bound to it, so child processes that inherit one session id count once. Processes without `CLAUDE_CODE_OAUTH_TOKEN` (for example API-key sessions) are ignored, and a process whose environ cannot be read is skipped. Among the eligible tokens the selection is deterministic and reset-first. Each eligible token is given a concurrent session limit of `maxConcurrentSessionCount` (default `10`), scaled by its optional `selectionWeight` (a positive number, default `1`). That limit is held at its full value while the free share of the token's 5-hour window is at or above `fullSpeedFiveHourFreeRatio` (default `0.5`), and is tapered linearly in proportion to the free share below that point, never dropping under `1`. The 5-hour window is the only window that lowers the limit: it is the one that runs out within a single working stretch, and a session that hits it mid-flight has to be restarted, which costs more than it saves. The 7-day window never lowers the limit, so a weekly allowance that is about to expire is drained at full speed rather than discarded unused; the 7-day window is instead what orders the candidates. The token whose 7-day window resets soonest among those still under their limit is selected, so allowance that is about to expire is consumed before the reset discards it; ties are broken by the fewer live sessions. All four tuning numbers (`maxConcurrentSessionCount`, `fullSpeedFiveHourFreeRatio`, `minFiveHourFreeRatio`, `minSevenDayFreeRatio`) are read from the fleet-wide config file named by `--fleetConfigFilePath` or the `TDPM_FLEET_CONFIG` environment variable, under a `liveSessionOauthTokenSelection` mapping; a key the file omits keeps its built-in value, while an unreadable file or an out-of-range value is reported as an error rather than silently ignored. A token at its limit is skipped in favour of the next soonest-resetting token that still has room, and when every eligible token is at its limit the soonest-resetting one is returned rather than none. A token that is the only eligible candidate is always chosen regardless of its weight or occupancy. The selected token string is written to stdout (pipeable) and the per-candidate decision trace is written to stderr; when no token passes the filter, nothing is written to stdout and the command exits non-zero with an explanatory message on stderr. The token-list path and cache directory are resolved exactly as for `selectOauthToken`. Because occupancy is read from `/proc/<pid>/environ`, this sub-command is Linux-specific.

The `startDaemon` command supports a `preparationWorker` mapping in the fleet-wide config file named by `--fleetConfigFilePath` or the `TDPM_FLEET_CONFIG` environment variable. This section controls per-token concurrency for the preparation worker pool. The only key currently supported is `normalConcurrentLimit` (positive integer, default `6`): the maximum number of concurrent preparation workers each Claude OAuth token may run at full-speed utilization. When either the 5-hour or 7-day utilization of a token rises above 80%, its per-token concurrency tapers linearly from `normalConcurrentLimit` down to 1. A key the file omits keeps its built-in value; an unreadable file or an out-of-range value is reported as an error rather than silently ignored. Example:

```yaml
preparationWorker:
  normalConcurrentLimit: 8
```

The `countInTmuxByHumanSessionsPerToken` sub-command reports, per Claude Code OAuth token, how many live interactive sessions running under that token belong to an issue that is currently in the GitHub Project Status `In Tmux by human`. It is read-only: it never starts the proxy, never mutates any cache file, and never writes any token anywhere. It enumerates live interactive sessions by scanning running processes on the local Linux host: for each process under `/proc` it reads the NUL-separated `/proc/<pid>/cmdline` and selects only processes launched for an interactive session, identified by a `--name <issue-url>` argument whose value is an HTTP or HTTPS URL; `Take ownership` background spawns (which have no `--name` argument) are excluded. For each selected process it reads `/proc/<pid>/environ` and takes its `CLAUDE_CODE_OAUTH_TOKEN` and `CLAUDE_CODE_SESSION_ID`; a process missing either is skipped, and a process whose files cannot be read is skipped. It then loads the project's issues with their Status (reusing the same on-disk issue cache the daemon uses), keeps only the sessions whose `--name` issue URL maps to an open issue in Status `In Tmux by human`, and counts the distinct `CLAUDE_CODE_SESSION_ID` values per token so child processes that inherit one session id count once. It writes one tab-separated line per token to stdout in the form `<tokenName>\t<count>` (the token name comes from the token list; the raw token value is never printed), and writes the per-run decision trace to stderr. The token-list path comes from `--tokenListJsonPath`, the `claudeCodeOauthTokenListJsonPath` config value, or the `CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH` environment variable. Because occupancy is read from `/proc/<pid>/cmdline` and `/proc/<pid>/environ`, this sub-command is Linux-specific.

The `killTmuxSession` sub-command cleanly kills a tmux session by running `tmux kill-session` together with stopping that session's per-session `cl-*.scope` systemd `--user` unit, consolidating logic that would otherwise need to be hand-written by callers. It takes exactly one of two mutually exclusive options. `--session <name>` kills another named session: it first stops the session's `cl-*.scope` unit (wrapping the `systemctl --user stop` call with `systemctl --user reset-failed` both before and after), then runs `tmux kill-session -t "=<name>"` using the exact-name `=` prefix so a session name that is itself a prefix of another session's name is never matched by mistake. `--self` terminates the current session from inside it: because a live session cannot run `tmux kill-session` on itself without being killed before its own scope-stop step completes, this mode derives the caller's own `cl-*.scope` unit name from `/proc/self/cgroup` and stops only that scope, without calling `tmux kill-session` at all. Neither option may be combined with the other, and providing neither is an error.

The `ownerCallFileAppend` and `ownerCallFileDelete` sub-commands maintain one temporary file per tmux session holding the owner calls that session raised and the owner has not answered yet. Both take the tmux session name alone and derive the file location from a single rule — `call-to-user/{pjcode or NA}/{session key}.yaml` under `--inTmuxDataDir`, where the session key is the session-name derivation the in-tmux sub-commands already apply to an issue url (every `.` and `:` replaced by an underscore) followed by the replacement of every `/` by an underscore. That derivation gives the same key for a raw issue url and for the tmux session name of it, so the writing side, which knows the session name, and the reading side, which knows the issue url, reach the same file and can never drift apart; it is the same rule the `serveWeb` route above resolves. Neither sub-command takes a project code: `ownerCallFileAppend` resolves it from the in-tmux-by-human data in `--inTmuxDataDir`, which holds one `{pjcode}.v4.json` per project listing that project's sessions, and the project whose session list holds the session gives the code. `NA` is the project code of a session no project lists, such as a long-running session that is not tied to one project. `ownerCallFileAppend` appends one YAML document per call, separated by YAML's own `---` document delimiter, creating the file when it does not exist so the oldest call stays first; each document repeats `sessionName` so a reader can reject a file that does not belong to the session it opened, carries `calledAt` as UTC ISO-8601 with second precision and a trailing `Z`, and carries `body` as a literal block with the explicit indentation indicator `2` so a body whose first line begins with a space is still valid YAML. The body is passed as `--body-file` rather than as an argument because a call body is multi-line and can be long. `ownerCallFileDelete` removes the file of that session under whichever project directory holds it, so a session that moved between projects after its call was appended leaves nothing behind, and exits successfully when the file is already absent, so a reset that runs twice is not an error. Neither sub-command writes anything to stdout on success. The scheduled run additionally deletes the file of every session whose issue is closed.

## Example 📖

Here's a quick example to illustrate its usage:

```
npx github-issue-tower-defence-management schedule -t schedule -c ./config.yml
```

```
npx github-issue-tower-defence-management schedule -t issue -c ./config.yml -i https://github.com/HiromiShikata/test-repository/issues/1
```

```
npx github-issue-tower-defence-management startDaemon --configFilePath ./preparator-config.yml
```

```
npx github-issue-tower-defence-management notifyFinishedIssuePreparation --configFilePath ./preparator-config.yml --issueUrl https://github.com/HiromiShikata/test-repository/issues/1
```

```
npx github-issue-tower-defence-management checkIssueReviewReadiness --configFilePath ./preparator-config.yml --issueUrl https://github.com/HiromiShikata/test-repository/issues/1
```

```
npx github-issue-tower-defence-management serveWeb --configFilePath ./preparator-config.yml --port 9980
```

```
TOKEN=$(npx github-issue-tower-defence-management selectOauthToken --tokenListJsonPath ./claudeCodeOauthTokenList.json)
```

```
TOKEN=$(npx github-issue-tower-defence-management selectLiveSessionOauthToken --tokenListJsonPath ./claudeCodeOauthTokenList.json)
```

```
npx github-issue-tower-defence-management countInTmuxByHumanSessionsPerToken --configFilePath ./preparator-config.yml --tokenListJsonPath ./claudeCodeOauthTokenList.json
```

## Config

### Schedule Command Config

The `config.yaml` for the `schedule` command must match the input type of `HandleScheduledEventUseCase.run()`. Below is the structure:

Workflow status names (`Unread`, `Awaiting Workspace`, `Preparation`, `Failed Preparation`, `Awaiting Quality Check`, `Todo by human`, `Todo by agent`, `In Tmux by human`, `In Tmux by agent`, `Done`, `Icebox`) are fixed code constants and cannot be overridden from CLI options, config files, or project README. The `schedule` command automatically creates any missing required statuses on the target project on each run via `SetupTowerDefenceProjectUseCase`. Projects with the legacy `Todo` and `In Tmux` status names are automatically migrated to `Todo by human` and `In Tmux by human` respectively by reusing the existing option IDs so that task associations are preserved. The legacy `PC Todo` status is removed from the required list and excluded from the project status list on the next setup run. The legacy `Awaiting Task Breakdown` status is removed from the required list; any project items in that status are automatically moved to `Todo by human` and the status option is removed on the next setup run.

The two tmux-related statuses have distinct meanings. `In Tmux by human` means a task being handled in a live tmux session together with the human owner, who attends the session and converses with it; the owner does look at these tasks. `In Tmux by agent` means a task managed by an agent in tmux that the human owner does not look at. A task launched into a live, owner-attended session therefore belongs to `In Tmux by human`, and setting such a task to `In Tmux by agent` would remove it from the owner's view.

```yaml
disabled: boolean # When true, skip all processing and return null
org: string # Organization name
projectUrl: string # URL of the target project
manager: string # GitHub account name of the manager
workingReport:
  repo: string # Repository name
  members: # Array of member's GitHub account names
    - string
    - string
  warningThresholdHour?: number # Optional: Warning threshold in hours
  spreadsheetUrl: string # URL of the Google Spreadsheet
  reportIssueTemplate?: string # Optional: Template for issue reports
  reportIssueLabels: # Array of issue labels
    - string
    - string
startPreparation?: # Optional: Enable automatic issue preparation workflow
  defaultAgentName: string # Default agent name to assign for preparation
  configFilePath: string # Path to config file passed to the aw command
  defaultLlmModelName?: string | null # Optional: Default LLM model name (overridable via llm-model: label)
  fallbackLlmModelName?: string | null # Optional: LLM model a token falls back to when defaultLlmModelName is a Sonnet model and that token's 7-day Sonnet weekly limit is exhausted while its fallback weekly window still has capacity (default: claude-opus-4-8). Routing is decided per token, so tokens with Sonnet headroom keep using Sonnet in the same pass. Per-issue llm-model: labels remain authoritative and are never overridden by the fallback
  defaultLlmAgentName?: string | null # Optional: Default LLM agent name (overridable via llm-agent: label)
  maximumPreparingIssuesCount: number | null # Max concurrent preparing issues. When token rotation is active, effective concurrency is also capped at 6 per available token. When null, the default is 6 per available token, or 6 without token rotation
  utilizationPercentageThreshold?: number # Optional: 5-hour utilization hard threshold (percentage, default 90). Tokens at or above this value are excluded from rotation
  allowedIssueAuthors?: string[] | null # Optional: Only start preparation for issues from these authors (null or omitted = no authors allowed; set an explicit list)
  preparationProcessCheckCommand?: string # Optional: Shell command template with {URL} placeholder to check if a preparation process is alive. When set, orphaned Preparation issues (process exits non-zero, or stale aw log) are evaluated for completion: if work is done they advance to Awaiting Quality Check; otherwise they fall back to Awaiting Workspace
  awaitingQualityCheckStatus?: string | null # Optional: Project status name for issues awaiting quality check. When set with preparationProcessCheckCommand, orphaned issues with no rejections advance to this status instead of awaitingWorkspaceStatus
  autoAdvanceQualityCheckEnabled?: boolean # Optional: When true, issues in the Awaiting Quality Check status are automatically advanced to Done on each scheduled cycle. Default false (issues remain in Awaiting Quality Check for human review). Use awaitingQualityCheckStatus to configure the status name when it differs from the default
  autoRevertReopenedDoneEnabled?: boolean # Optional: When true, issues in the Done status that were reopened on GitHub (stateReason = REOPENED) are automatically moved back to Awaiting Workspace on each scheduled cycle. Default false. Requires startPreparation to be configured.
  codexHomeCandidates?: string[] | null # Optional: Ordered list of CODEX_HOME directory paths. Each launched Codex job cycles through the list; absent or empty keeps current behavior
  awLogDirectoryPath?: string # Optional: Directory path where aw log files named {org}_{repo}_{number}_* are written. Used with awLogStaleThresholdMinutes to detect zombie-wrapper orphans
  awLogStaleThresholdMinutes?: number # Optional: Minutes since last aw log mtime after which a Preparation issue is considered orphaned even when pgrep still returns 0 (outer wrapper alive but inner claude dead). Requires awLogDirectoryPath
  labelsAsLlmAgentName?: string[] | null # Optional: List of issue labels that are themselves agent names. When an issue carries any label that is included in this list, that label name is used as the agent name. Selection precedence is: (1) explicit `llm-agent:` label, (2) labelsAsLlmAgentName entry match, (3) `category:` label, (4) defaultLlmAgentName, (5) defaultAgentName
developerAgentNames?: string[] # Optional: The agent names treated as "developer" agents for PR link, CI, and conflict checks in both the notifyFinishedIssuePreparation and scheduled revert flows. When omitted or empty, defaults to `['developer']`. Set this when your project uses one or more agent names for coding tasks and you want those agents' issues to undergo the same PR/CI/conflict validation that the built-in `developer` name triggers. Readable from the project README config section; readme value takes precedence over the config file value. Declared at the top level (sibling of startPreparation), not inside it. Also accepts the legacy single-string key `developerAgentName` for backward compatibility (wrapped as a one-element array).
labelsNotRequiringPullRequest?: string[] | null # Optional: List of issue labels whose issues are exempt from the pull-request part of the review-readiness check, without that label also being used as an agent name. An issue carrying any of these labels is never rejected for a missing, draft, conflicted, or failing pull request, and its agent is still resolved by the normal precedence (explicit `llm-agent:` label, labelsAsLlmAgentName entry match, `category:` label, defaultLlmAgentName, defaultAgentName). Every label in labelsAsLlmAgentName is exempt as well, so an existing config that relied on that key keeps its behaviour. Use this key for a label such as `story` whose issues produce child issues rather than a pull request and for which no agent of the same name is installed. Declared at the top level (sibling of startPreparation), not inside it.
changeTargetPathAliases?: Record<string, string> | null # Optional: Map of short alias keys to full repository-root-relative directory paths, for use with `change-target:<alias>` labels. Allows deeply nested paths that exceed GitHub's 50-character label limit to be referenced via a short alias. Example: `{ "adapters": "src/domain/usecases/adapter-interfaces" }` — a label `change-target:adapters` then matches files under `src/domain/usecases/adapter-interfaces/`. Keys not matching any `change-target:` label value are ignored; values with leading or trailing slashes are normalized automatically. Declared at the top level (sibling of startPreparation), not inside it.
claudeCodeOauthTokenListJsonPath?: string # Optional: Path to a JSON file listing long-term Claude Code OAuth tokens to rotate across (see "Claude OAuth Token Rotation" below). Declared at the top level (sibling of startPreparation), not inside it.
autoAssignManagerAuthors?: string | string[] | null # Optional: Restrict which authors' open, unassigned issues and pull requests are auto-assigned to the manager. Accepts a comma-separated string or an array of GitHub author logins (bot logins carry the `[bot]` suffix, for example `renovate[bot]`). When set to a non-empty list, only items whose author is in the list are auto-assigned; when omitted and allowedIssueAuthors is set, allowedIssueAuthors is used as the author filter; when both are omitted, null, or empty, every open unassigned item is auto-assigned. Author matching is exact equality. Declared at the top level (sibling of startPreparation), not inside it.
queryToAddProjectEnabled?: boolean # Optional: Enable the queryToAddProject search (default false). The search runs only when this is true, so setting queryToAddProject alone changes nothing. Declared at the top level (sibling of startPreparation), not inside it.
queryToAddProject?: string | null # Optional: GitHub search query string, used only when queryToAddProjectEnabled is true. Each schedule cycle, issues and pull requests matching this query that are not already on the project board and whose author satisfies the effective author filter (autoAssignManagerAuthors, falling back to allowedIssueAuthors) are added to the project and assigned to the manager. Items whose author does not satisfy the filter are skipped entirely and not added to the board. Omit or set to null to skip this search. Declared at the top level (sibling of startPreparation), not inside it.
dailySecurityScan?: # Optional: Run a daily OSV-Scanner security scan across locally cloned repositories of the org. Declared at the top level (sibling of startPreparation). When the findings of one repository cannot be written to GitHub — for example because that repository is archived and therefore read-only, or because the rendered findings exceed what the issues API accepts — the failure is logged with the repository name and the cause, that repository is skipped, and the remaining repositories are still scanned and the CISA KEV report still runs.
  scanBaseDirectory: string # Base directory searched (4 levels deep) for cloned repositories to scan
  targetHourUtc: number # UTC hour (0-23) at which the scan runs once per day; the scan runs only when a target date matches this hour at minute zero
  enableKevNvdReport?: boolean # Optional: When true, also report CISA KEV catalog additions that have not been reported yet. A watermark recording the newest reported dateAdded, plus the CVE identifiers already reported on that date, is persisted at $XDG_CACHE_HOME/tdpm/kev-report-watermark.json (falling back to ~/.cache when XDG_CACHE_HOME is unset) and advanced over every addition the run considered, whether or not that addition matched a package the scan actually found and therefore produced a report issue. Only an addition whose CVE identifier matches a package the scan found at an installed version is written into the report issue. On the first run, when no watermark is stored yet, the additions dated on or after the day before the run are considered. Known limitations: (1) if the watermark write fails after the report issue was created, the failure is logged with the state file path and the cause, the run continues so that unrelated scheduled work is not aborted, and the same additions are considered again on the next run, so the guarantee is at-least-once at that boundary rather than exactly-once; (2) an addition whose dateAdded is strictly earlier than the stored watermark date, whether back-dated or published very late, is never selected again, so the protection covers late additions on the watermark date itself and not arbitrary lateness. When the stored watermark file exists but cannot be read or is malformed (including a stored date that is not a real calendar date in YYYY-MM-DD form), the KEV report is skipped for that run, an error naming the file and the cause is logged, the file is left untouched for inspection, and the rest of the scheduled work continues
  kevReportRepo?: string # Optional: Repository name (within org) where the CISA KEV additions issue is created. Required for KEV reporting
```

Example:

```yaml
disabled: false
org: 'my-org'
projectUrl: 'https://github.com/orgs/my-org/projects/1'
manager: 'HiromiShikata'
workingReport:
  repo: 'work-report'
  members:
    - 'HiromiShikata'
    - 'octokit'
  warningThresholdHour: 40
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/xxx'
  reportIssueTemplate: |
    ## Working Time Report

    ### Summary
    Period: {period}
    Team: {team}

    ### Details
    {details}
  reportIssueLabels:
    - 'report'
    - 'working-time'
  slack:
    userToken: 'xoxp-xxx'
startPreparation:
  defaultAgentName: 'aw'
  configFilePath: '/path/to/agent-config.yml'
  defaultLlmModelName: 'claude-opus-4-5'
  maximumPreparingIssuesCount: 3
  utilizationPercentageThreshold: 90
  preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"'
  awaitingQualityCheckStatus: 'Awaiting Quality Check'
  autoAdvanceQualityCheckEnabled: false # set to true to auto-advance to Done without human review
  autoRevertReopenedDoneEnabled: false # set to true to auto-revert reopened Done issues to Awaiting Workspace
  awLogDirectoryPath: '/home/user/logs-aw'
  awLogStaleThresholdMinutes: 15
  labelsAsLlmAgentName:
    - story
    - story:body-condition
dailySecurityScan:
  scanBaseDirectory: '/home/user/repos'
  targetHourUtc: 0
  enableKevNvdReport: true
  kevReportRepo: 'security-reports'
```

### startDaemon and notifyFinishedIssuePreparation Commands Config

The config YAML for `startDaemon` and `notifyFinishedIssuePreparation` commands:

```yaml
projectUrl: string # URL of the GitHub project
projectName: string # Project name (used for cache directory path)
defaultAgentName: string # Default agent name for issue preparation
defaultLlmModelName?: string # Optional: Default LLM model name
fallbackLlmModelName?: string # Optional: LLM model a token falls back to when defaultLlmModelName is a Sonnet model and that token's 7-day Sonnet weekly limit is exhausted while its fallback weekly window still has capacity (default: claude-opus-4-8). Routing is decided per token, so tokens with Sonnet headroom keep using Sonnet in the same pass. Per-issue llm-model: labels remain authoritative
defaultLlmAgentName?: string # Optional: Default LLM agent name
maximumPreparingIssuesCount?: number # Optional: Max concurrent preparing issues. When token rotation is active, effective concurrency is also capped at 6 per available token. Omitted defaults to 6 per available token, or 6 without token rotation
utilizationPercentageThreshold?: number # Optional: 5-hour utilization hard threshold (percentage, default 90). Tokens at or above this value are excluded from rotation
allowedIssueAuthors?: string # Optional: Comma-separated list of allowed issue authors
autoAssignManagerAuthors?: string # Optional: Comma-separated list of author logins whose open, unassigned issues and pull requests are auto-assigned to the manager. When set to a non-empty list, only items whose author is in the list are auto-assigned; when omitted and allowedIssueAuthors is set, allowedIssueAuthors is used as the fallback filter; when both are omitted or empty, every open unassigned item is auto-assigned. Author matching is exact equality; bot logins carry the `[bot]` suffix (for example `renovate[bot]`)
queryToAddProjectEnabled?: boolean # Optional: Enable the queryToAddProject search (default false). The search runs only when this is true, so setting queryToAddProject alone changes nothing
queryToAddProject?: string # Optional: GitHub search query string, used only when queryToAddProjectEnabled is true. Each schedule cycle, issues and pull requests matching this query that are not already on the project board and whose author satisfies the effective author filter (autoAssignManagerAuthors, falling back to allowedIssueAuthors) are added to the project and assigned to the manager. Items whose author does not satisfy the filter are skipped and not added to the board. Omit to skip this search.
thresholdForAutoReject?: number # Optional: Consecutive rejections before escalation (default: 3)
thresholdForDispatchLoop?: number # Optional: How many times one agent may be dispatched on a single issue since the last human comment before the issue is moved to Failed Preparation instead of being dispatched again (default: 6). This bounds dispatch loops in which the agents do report each round, both when an agent names itself as the next step and when two agents name each other in turn. Any comment that is neither an agent report nor a comment this tool posts itself counts as human input and restarts the count
workflowBlockerResolvedWebhookUrl?: string # Optional: Webhook URL. Supports {URL} and {MESSAGE} placeholders
preparationProcessCheckCommand?: string # Optional: Shell command template with {URL} placeholder to check if a preparation process is alive. Orphaned Preparation issues (process exits non-zero, or stale aw log) are evaluated for completion: if work is done they advance to Awaiting Quality Check; otherwise an `Auto Status Check: REJECTED` comment is posted and the issue falls back to Awaiting Workspace, except that once `thresholdForAutoReject` cumulative orphan-time rejections accumulate within the recent comment window (and no earlier escalation marker is present) the issue is transitioned to Failed Preparation instead
codexHomeCandidates?: string[] # Optional: Ordered list of CODEX_HOME directory paths for Codex profile cycling. Absent or empty keeps current behavior
claudeCodeOauthTokenListJsonPath?: string # Optional: Path to a JSON file listing long-term Claude Code OAuth tokens to rotate across (see "Claude OAuth Token Rotation" below)
awLogDirectoryPath?: string # Optional: Directory path where aw log files named {org}_{repo}_{number}_* are written. Used with awLogStaleThresholdMinutes to detect zombie-wrapper orphans
awLogStaleThresholdMinutes?: number # Optional: Minutes since last aw log mtime after which a Preparation issue is considered orphaned even when pgrep still returns 0. Requires awLogDirectoryPath
developerAgentNames?: string[] # Optional: The agent names treated as "developer" agents for PR link, CI, and conflict checks. When omitted or empty, defaults to `['developer']`. Set this when your project uses one or more agent names for coding tasks. Readable from the project README config section; readme value takes precedence over the config file value. Also accepts the legacy single-string key `developerAgentName` for backward compatibility (wrapped as a one-element array).
labelsAsLlmAgentName?: string[] # Optional: List of issue labels that are themselves agent names. When an issue carries any label that is included in this list, that label name is used as the agent name. Selection precedence is: (1) explicit `llm-agent:` label, (2) labelsAsLlmAgentName entry match, (3) `category:` label, (4) defaultLlmAgentName, (5) defaultAgentName
consoleAccessToken?: string # Optional: Access token for the Console HTTP server. When set, `startDaemon` TCP-probes port 9980 before the first preparation cycle and, if nothing responds, spawns `serveWeb` as a detached background process on that port. SIGTERM and SIGINT sent to the daemon are forwarded to the console server child before the daemon exits. When unset, no console server is started automatically.
consoleDataOutputDir?: string # Optional: Base output directory for the per-project Console list.json files. When set, the schedule cycle writes the full tab files and notifyFinishedIssuePreparation immediately patches the affected tab files after each status transition (no additional GitHub fetch). When unset, Console list generation and patching are skipped
consoleGithubTokenFileDir?: string # Optional: Directory path containing per-project GitHub token files named tdpm-github-token-{pjcode}.txt. When set together with consoleProjects, serveWeb resolves a per-project GH token by matching the repository owner against each project URL. Falls back to the default token when no match is found or the file is absent.
workflowBlockerStoryName?: string # Optional: Story field name that the Console "workflow-blocker" tab matches (case-insensitive). Every non-closed issue with this story is listed regardless of status or reactivation-trigger fields. When unset, the workflow-blocker list is always empty
inTmuxDataOutputDir?: string # Optional: Base output directory for the in-tmux-by-human per-project and index JSON files written each schedule cycle. When unset, in-tmux-by-human generation is skipped
inTmuxConsoleBaseUrl?: string # Optional: Console base URL used to build the tdpmConsoleUrl in the v3/v4 in-tmux-by-human files (for example https://console.example.com). When unset, the v3 and v4 files are skipped
inTmuxConsoleToken?: string # Optional: Token embedded in the ?k= query string of the v4 in-tmux-by-human files. When unset, the v4 per-project file and index.v4.json are skipped
inTmuxProjectOrder?: string[] # Optional: Ordered list of project codes used to build the in-tmux-by-human index files. When unset or empty, the index files are skipped
newIssueRepo?: string # Optional: Repository name used only for the repo segment of the v4 in-tmux-by-human newIssueUrl. When unset, the newIssueUrl repo segment falls back to workingReport.repo, preserving the existing behavior. Only the newIssueUrl is affected; workingReport.repo and every other use of it are unchanged
inTmuxLauncherCommand?: string # Optional: Launcher command that starts an interactive session for an `In Tmux by human` issue. Each schedule cycle, any open assigned `In Tmux by human` issue without a live session is restarted by running this command with the issue URL as its argument inside a new detached tmux session named after the issue URL. When unset, session restarting is skipped
tokenExhaustionHandoverEnabled?: boolean # Optional: When true, the daemon detects Claude sessions whose OAuth token is near/at the rate limit (five-hour free < 0.10, seven-day free < 0.05 for tmux leaders, blocked/rejected, blockedUntilEpoch in the future, or a rejected weekly hard-cap whose resetsAt is still in the future) and, only when a DIFFERENT token is confirmed not-stale-not-exhausted, performs the handover: a checkpoint instruction is sent to tmux leaders via `tmux send-keys` (impl `-p` subagents receive SIGTERM instead) and the session is killed after the grace period. Issue-URL leaders are relaunched by the preparation daemon; bare-name resident leaders are relaunched by this step via `cl <name>` on a fresher token; impl subagents are left for the daemon to re-dispatch. Requires `claudeCodeOauthTokenListJsonPath`. When false, detection and logging still run but no send-keys, kill, or relaunch is performed (dry-run). Default false
tokenExhaustionHandoverMessage?: string # Optional: Checkpoint instruction sent to an exhausted issue-URL leader via `tmux send-keys`. When unset, a built-in default that tells the session to checkpoint to its task issue and then self-kill is used
tokenExhaustionHandoverBareNameLeaderMessage?: string # Optional: Checkpoint instruction sent to an exhausted bare-name resident leader (a leader started with a bare `--name` and no task issue) via `tmux send-keys`. When unset, a built-in default that tells the leader to checkpoint into each in-flight subagent's own issue and NOT self-kill (this step relaunches it) is used
tokenRateLimitSnapshotBaseDir?: string # Optional: Directory path for the per-token rate-limit snapshot JSON files read by the token exhaustion handover step. When unset, defaults to ${XDG_CACHE_HOME:-~/.cache}/tdpm/ratelimit
tokenExhaustionGracePeriodSeconds?: number # Optional: Seconds to wait after sending the handover message before killing the tmux session, giving the session time to shut down gracefully. Default 180
tokenExhaustionHandoverStateFilePath?: string # Optional: File path for the durable handover grace/debounce state (which sessions were signaled and when), written atomically so grace tracking survives daemon restarts. When unset, defaults to ${XDG_CACHE_HOME:-~/.cache}/tdpm/token-exhaustion-handover-state-tdpm-native.json (a TDPM-native filename kept distinct from any standalone monitor's state file so the two never share state)
silentNotificationEnabled?: boolean # Optional: Master switch for the silent live session self-check notification. The step is a no-op unless this is `true` (or the `TDPM_SILENT_NOTIFICATION_ENABLED` environment variable equals the string `true`). This gate prevents the step from acting automatically when the daemon is run with a default configuration; it must be explicitly turned on. Default false
subAgentOutputRootDirectory?: string # Optional: Root directory holding one output file per sub-process (file name derived from the sub-process label). The modification time of each file is read to compute how long the sub-process output has been idle. When unset, sub-process idle time is reported as 0 and only the running-time threshold can trigger a sub-process notification
subAgentProcessMatchPattern?: string # Optional: Regular expression matched against each process command line to discover the sub-processes that belong to a monitored session. The expression must define a named capture group `session` whose value equals the monitored session name, and may define a named capture group `label` used as the display name. When unset, the sub-process check is skipped
ownerCallMarker?: string # Optional: Marker substring that identifies an assistant message asking the owner for a decision or confirmation. When set, the main-session stalled section is suppressed while a session's latest marker-bearing assistant message is newer (by full timestamp) than its latest genuine owner reply. A marker ending with `>` also matches its candidate form, produced by replacing that trailing `>` with `-pending>`, so a configured `<call-to-user>` matches both `<call-to-user>` and `<call-to-user-pending>`; any marker not ending with `>` matches only itself. When unset, no session is treated as waiting on the owner
subAgentTranscriptRootDirectory?: string # Optional: Projects root directory (for example `~/.claude/projects`) under which each session's transcript is stored as `<cwd-slug>/<sessionId>.jsonl` and its sub-agent transcripts live in the sibling `<cwd-slug>/<sessionId>/subagents/` directory as one `agent-<id>.jsonl` file per sub-agent. Because the on-disk directory is keyed by the session's working-directory slug and session id rather than by the tmux session name, the sub-agent directory is derived from the already-resolved main-session transcript path (the `.jsonl` suffix is stripped and `subagents` is appended). A sub-agent is treated as finished when the last meaningful entry of its transcript is a completion or termination marker: an assistant message whose `stop_reason` is `end_turn` or `stop_sequence`, an assistant message whose final content block is `text` (a final answer returned to the parent, which Claude Code often writes with a `null` `stop_reason`), a user message whose final content block is `text` (a terminal user entry such as `[Request interrupted by user]`), a user message whose final content block is the `tool_result` of a `StructuredOutput` tool call (the structured output the sub-agent delivered as its final answer), or a user message with no content blocks. A finished sub-agent is skipped only when it is no longer listed in the harness running-sub-agent set (`subAgentRuntimeRootDirectory`), or when that set cannot be read at all; a finished sub-agent the running set still lists is kept and reported as an unconsumed result, because the leader clears its record line once it has acted on the completion. Only a sub-agent whose last entry is an assistant message with a pending `tool_use` block and no following tool result is still considered active; its idle time is computed from the transcript file modification time (following symlinks) and the running time from its first entry timestamp. An active sub-agent whose pending tool command matches a live host process is classified as waiting on that external process and is exempt from the idle threshold (a genuinely hung sub-agent whose matching process is absent is still flagged), and the running threshold announces once per crossing per label. When set, this transcript-based discovery is used instead of `subAgentProcessMatchPattern`. When unset, the process-match discovery is used
subAgentRuntimeRootDirectory?: string # Optional: Runtime root directory (for example `/tmp/claude-<uid>`) under which each session's positive running-sub-agent set is expected at `<cwd-slug>/<sessionId>/running-subagents.txt`. Each non-blank line has the form `<agentId> <label-or-branch-or-URL>`; only the first whitespace-delimited token of the line is taken as the sub-agent id, and any remaining text on the line (a label, branch name, or pull request URL) is ignored. Blank and whitespace-only lines are skipped. When transcript-based discovery is used, this enables a positive process-liveness gate: a sub-agent whose id is absent from the running set has already exited, so its stale on-disk transcript is not flagged even when its tail is a plain in-flight `tool_result`. Membership in the running set is also what distinguishes a consumed completion from an unconsumed one: a finished sub-agent the set still lists is reported as an unconsumed result and drives the unconsumed-result reminder section, while one absent from the set is dropped. When this directory is unset it defaults to `<os-tmpdir>/claude-<uid>` (or is disabled on platforms without a numeric user id); when the directory or the running-set file cannot be read the gate is skipped (fail-open) and the terminal-status and completion-marker exclusions remain the sole guards
mainSilentThresholdSeconds?: number # Optional: Seconds of main-session output silence after which the main-session self-check section is sent. Default 600
unansweredOwnerCallGraceSeconds?: number # Optional: Retained only for backward compatibility of the configuration surface and no longer consulted. An unanswered owner call now suppresses the main-session stalled section unconditionally, with no age or grace expiry, so no value of this key changes any behaviour. Default 3600
subAgentSilentThresholdSeconds?: number # Optional: Seconds of sub-process output silence after which the sub-process section is sent. Default 300
subAgentRunningThresholdSeconds?: number # Optional: Seconds a sub-process may run before the sub-process section is sent regardless of its output silence. Default 900
silentNotificationStaggerSeconds?: number # Optional: Seconds to wait between consecutive session notifications within one cycle, so the targets are notified sequentially rather than all at once. Default 25
candidateDebounceRecencyWindowSeconds?: number # Optional: Recency window in seconds within which a session must have been recorded as a notification candidate in a previous cycle for the two-consecutive-cycle debounce to allow a notification this cycle. A small multiple of the schedule interval to tolerate interval jitter. Default 900
candidateDebounceStateFilePath?: string # Optional: Path to the JSON state file that persists the per-cycle candidate session set used by the two-consecutive-cycle debounce. When unset, defaults to ${XDG_CACHE_HOME:-~/.cache}/tdpm/silent-session-candidates.json
activeHubTaskStatus?: string # Optional: GitHub Project Status value that marks a session's hub task as still actively worked in an interactive session. For a session whose name is a `https://github.com/{owner}/{repo}/issues/{N}` issue URL, the hub task's latest state and Status are resolved before sending and the notification is suppressed when the issue is closed or merged, or when its Status differs from this value. Each resolved status is cached by issue URL (see hubTaskStatusCacheStateFilePath and hubTaskStatusCacheTtlSeconds) so a fresh cached entry decides the gate without a new GitHub query. When the hub task cannot be resolved (the resolver returns no tracked task, or a transient API error is thrown), a cached status is used as a fallback even after it expires: a cached active entry keeps the notification (the session is still notified if genuinely stalled) and a cached closed or non-active entry suppresses it. Only when there is no cached status at all and live resolution fails does the gate fail open once, logging a distinct warning. Sessions whose name is not a github.com issue URL are never checked. When unset, this hub-task active-status check is a no-op and existing behavior is preserved
hubTaskStatusCacheStateFilePath?: string # Optional: Path to the JSON state file that caches each hub task's resolved state and Status keyed by issue URL for the hub-task active-status gate. When unset, defaults to ${XDG_CACHE_HOME:-~/.cache}/tdpm/silent-session-hub-task-status.json
hubTaskStatusCacheTtlSeconds?: number # Optional: Seconds a cached hub-task status is considered fresh enough to decide the gate without re-querying GitHub. A cached entry older than this is re-resolved, but is still used as a fallback when re-resolution fails. Default 300
silentMainStalledStaleOwnerCallMessage?: string # Optional: Overrides the stale-owner-call reminder body. That reminder variant is currently never composed, because an unanswered owner call suppresses the main-session stalled section unconditionally, so this key has no effect. The owner-call format guidance is appended. When unset, a built-in message directing the agent to re-raise its ask self-containedly or continue autonomously is used
silentSubAgentIdleMessageHeader?: string # Optional: Overrides the line shown above the sub-process list in the idle (no-output) sub-process message. When unset, a generic built-in line is used
silentSubAgentIdleMessageFooter?: string # Optional: Overrides the line shown below the sub-process list in the idle (no-output) sub-process message. When unset, a generic built-in line is used
silentSubAgentLongRunningMessageHeader?: string # Optional: Overrides the line shown above the sub-process list in the long-running sub-process message. When unset, a generic built-in line is used
silentSubAgentLongRunningMessageFooter?: string # Optional: Overrides the line shown below the sub-process list in the long-running sub-process message. When unset, a generic built-in line is used
outputDegenerationResetEnabled?: boolean # Optional: Master switch for the output-degeneration reset step. When true, the daemon inspects every live interactive Claude Code session named after a github.com issue or pull-request URL and, when the session's most recent assistant turn is a collapsed single-token repeat loop (intra-turn) or the same isolated short trailing token recurs across the majority of recent turns (cross-turn), sends a checkpoint warning to the session via `tmux send-keys`, waits the grace period, and kills the tmux session so it is relaunched fresh. When false, detection and logging still run but no warning or kill is performed (dry-run). Default false
outputDegenerationWarningMessage?: string # Optional: Checkpoint warning sent to a degenerated session via `tmux send-keys` before it is reset. When unset, a built-in default that tells the session to checkpoint its resume state to its task issue is used
outputDegenerationGraceSeconds?: number # Optional: Seconds to wait after sending the degeneration warning before killing the tmux session, giving the session time to write its checkpoint. Default 5
outputDegenerationCooldownSeconds?: number # Optional: Seconds a session that was just reset is excluded from re-detection, so it is not repeatedly reset before its fresh relaunch completes. Default 300
outputDegenerationCooldownStateFilePath?: string # Optional: Path to the JSON state file that persists the per-session last-reset time used for the cooldown. When unset, defaults to ${XDG_CACHE_HOME:-~/.cache}/tdpm/output-degeneration-cooldown.json
changeTargetPathAliases?: # Optional: Map of short alias keys to full repository-root-relative directory paths. Allows `change-target:<alias>` labels to reference deeply nested paths that exceed GitHub's 50-character label limit. When a `change-target:` label's value matches a key in this map, it is expanded to the corresponding full path before confinement checking. Values with leading or trailing slashes are normalized automatically. Example below
  adapter-interfaces: src/domain/usecases/adapter-interfaces
errorReportingRepository?: string # Optional: GitHub repository in `owner/repo` format where CLI errors are automatically reported as issues. When set, any unhandled error that escapes the CLI process creates a new GitHub issue in this repository (title: `CLI error: {errorName}: {first 80 chars of message}`), or adds a comment to an existing open issue with the same title. Requires GH_TOKEN. Can also be set via the TDPM_ERROR_REPORT_REPOSITORY environment variable without a config file.
```

Workflow status names (`Unread`, `Awaiting Workspace`, `Preparation`, `Failed Preparation`, `Awaiting Quality Check`, `Todo by human`, `Todo by agent`, `In Tmux by human`, `In Tmux by agent`, `Done`, `Icebox`) are hardcoded constants and are not accepted via this config, the CLI, or the project README. To ensure they exist on the target project, run the `schedule` command — it invokes `SetupTowerDefenceProjectUseCase` automatically. Projects with the legacy `Todo` and `In Tmux` status names are automatically migrated; `PC Todo` and `Awaiting Task Breakdown` are removed on the next setup run (items in `Awaiting Task Breakdown` are moved to `Todo by human` before the option is deleted).

Example:

```yaml
projectUrl: 'https://github.com/orgs/my-org/projects/1'
projectName: 'my-project'
defaultAgentName: 'aw'
defaultLlmModelName: 'claude-opus-4-5'
maximumPreparingIssuesCount: 3
utilizationPercentageThreshold: 90
thresholdForAutoReject: 3
thresholdForDispatchLoop: 6
workflowBlockerResolvedWebhookUrl: 'https://example.com/webhook?url={URL}&msg={MESSAGE}'
preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"'
awLogDirectoryPath: '/home/user/logs-aw'
awLogStaleThresholdMinutes: 15
codexHomeCandidates:
  - .codex-dev1
  - .codex-dev2
  - .codex-main
```

#### README-based Config Overrides

For `startDaemon`, `schedule`, and `notifyFinishedIssuePreparation`, the GitHub project README can override config file values. Add a `<details><summary>config</summary>...</details>` section with YAML content to the project README. This takes highest priority over both the config file and CLI arguments. Any top-level YAML key inside the `config` block that is not a recognized override (for example a typo such as `maximumPreparingIssueCount` missing the trailing `s`) is ignored and logged via `console.warn` together with the project URL, so misspelled keys do not silently disable an intended override.

### Claude OAuth Token Rotation

When `claudeCodeOauthTokenListJsonPath` is set, `startDaemon` distributes preparation jobs across multiple long-term Claude Code OAuth tokens to keep each token's 5-hour rate-limit window from saturating. The mechanism has three parts:

1. Token list file (referenced by `claudeCodeOauthTokenListJsonPath`): a JSON array of `{ name, token, selectionWeight? }` records, for example:

   ```json
   [
     { "name": "personal-1", "token": "sk-ant-..." },
     { "name": "personal-2", "token": "sk-ant-...", "selectionWeight": 0.8 }
   ]
   ```

   The `token` value is a long-lived (~1 year) Anthropic OAuth access token (`sk-ant-oat01-...`). The `name` field is optional; when absent, TDPM assigns a positional name (`token-1`, `token-2`, …) based on the entry's index in the array. The `selectionWeight` field is optional and defaults to `1` when absent; it is a positive number that makes a token be used less than the others — a token with a smaller weight (for example `0.8`) is chosen proportionally less often by `selectOauthToken`, and is allowed proportionally fewer simultaneous live sessions by `selectLiveSessionOauthToken`. The weight only reorders preference among tokens that already pass every eligibility, rate-limit, and exhaustion check; it never bypasses that filtering and never starves a low-weight token, which is still chosen whenever it is the only eligible candidate. Entries without a string `token` are skipped. Missing files or malformed JSON yield no tokens and disable rotation for that run (the daemon then falls back to whatever `CLAUDE_CODE_OAUTH_TOKEN` is already in the environment).

2. Local reverse proxy (`127.0.0.1:8787`): on each `startDaemon` run, the daemon TCP-probes the port. If nothing responds, it spawns a detached child running `bin/adapter/proxy/proxyEntry.js`. The proxy forwards every request to `api.anthropic.com`, observes the `anthropic-ratelimit-unified-*` response headers, and writes them to a per-token cache file at `${XDG_CACHE_HOME:-~/.cache}/tdpm/ratelimit/<sha256-of-token>.json`. The cache file stores the latest 5-hour and 7-day utilization, reset epochs, and the unified, 5-hour, and 7-day statuses (used to detect `blocked` and `rejected` state per window). In addition to the headline unified headers, the proxy records the model-specific weekly limits — at minimum `seven_day_sonnet` and `seven_day_opus` — per token from two sources: the per-model unified response headers `anthropic-ratelimit-unified-7d_sonnet-status`/`-reset` and `anthropic-ratelimit-unified-7d_opus-status`/`-reset` (present on every response), and the streamed response body's `rate_limit` events (objects carrying `rateLimitType`, `status`, and `resetsAt`). When both sources describe the same claim, the body-derived value takes precedence. Because the per-model windows are tracked separately, a token can be `rejected` on the headline `anthropic-ratelimit-unified-status` (whose value reflects only the representative, most-binding claim — for example `seven_day_sonnet`) while its `seven_day_opus` window is still allowed and Opus requests on that token still succeed. The `fable` model's weekly limit is reported by neither the response headers nor the streamed body events, so it is tracked reactively and in binary form. Because Anthropic exposes no per-model rate-limit data, a 429 on a `fable` request cannot be split into "fable's own weekly limit" versus "the token's overall weekly limit"; the proxy therefore records the marker only when the 429 is a genuine seven-day (weekly) rejection, which is the only case in which the token cannot serve `fable` regardless of model. Concretely: when a request whose JSON body selects a `fable` model (a `model` value containing `fable`, such as `claude-fable-5`) receives an HTTP 429 whose response carries `anthropic-ratelimit-unified-7d-status: rejected`, the proxy records a rejected `seven_day_fable` entry in that token's `modelWeeklyLimits`. A model-agnostic 429 that is not a weekly rejection — a five-hour-window rejection (`anthropic-ratelimit-unified-5h-status: rejected` while the seven-day window is not rejected) or a transient 429 carrying no rate-limit rejection headers at all — does NOT set the marker, so a token whose weekly `fable` quota is intact is not wrongly excluded from `fable` selection. The marker's `resetsAt` is taken from the `anthropic-ratelimit-unified-7d-reset` header when that reset is present, and otherwise falls back to the same cooldown rule as the headerless 429 case below (`now + Retry-After` seconds when the `Retry-After` header is present, clamped to a maximum of 600 seconds, otherwise a fixed default of 90 seconds). No remaining-quota or utilization percentage is computed for `fable`; the marker is a plain "this token's fable is currently exhausted" flag that clears once its `resetsAt` has passed. When a response is an HTTP 429 that carries no `anthropic-ratelimit-*` headers at all (for example a `rate_limit_error` with `x-should-retry: true`), the proxy records a short-lived per-token cooldown as a `blockedUntilEpoch` field on that token's cache file without discarding the last-good snapshot: the cooldown end is `now + Retry-After` seconds when the `Retry-After` header is present (clamped to a maximum of 600 seconds), otherwise a fixed default of 90 seconds. A later response that does carry `anthropic-ratelimit-*` headers overwrites the cache and clears the cooldown.

3. Selection: before spawning each `aw` job, the daemon reads every token's cache file. A cached observation is treated as expired once its reset epoch has passed: when the current time is past the 5-hour reset, that token's 5-hour utilization is treated as `0` and any 5-hour-window rejection is cleared; likewise, when the 7-day reset has passed, the 7-day utilization is treated as `0` and any 7-day-window rejection is cleared; a model-specific weekly limit rejection is cleared once that limit's `resetsAt` has passed. This stale-reset expiry prevents a token that has actually recovered from being locked out of rotation forever (an excluded token receives no new requests, so the proxy never re-observes it). After expiry normalization, a token is excluded only for a genuinely model-agnostic reason: its status is `blocked`, its (non-expired) 5-hour-window rejection is still active, its `blockedUntilEpoch` cooldown is still in the future, or its 5-hour utilization meets or exceeds the configured threshold. The headline `anthropic-ratelimit-unified-status` being `rejected` does NOT by itself exclude a token, because that status reflects only the representative (most-binding) claim — a Sonnet-exhausted token whose `seven_day_opus` window is still allowed must remain in rotation and route to Opus. The model for each remaining token is then routed independently: the configured default model is preferred when that token's matching weekly window is not rejected, otherwise the configured fallback model (default `claude-opus-4-8`) is used when its matching weekly window is not rejected; a token is excluded for weekly limits only when every candidate model's weekly window is rejected or the generic `seven_day` window is rejected. This routing is per token, so within a single pass a token whose `seven_day_sonnet` window is exhausted is spawned on the fallback Opus model while sibling tokens that still have Sonnet headroom keep using Sonnet. A cooled-down token becomes selectable again automatically once its `blockedUntilEpoch` has passed. The model name maps to a limit type: a model name containing `sonnet` maps to `seven_day_sonnet`, one containing `opus` maps to `seven_day_opus`, otherwise `seven_day`; the generic `seven_day` rejection excludes a token regardless of model. The remaining eligible tokens are sorted by time until the 7-day reset deadline ascending (soonest 7-day reset first, so quota that would otherwise expire unused is consumed first), with 5-hour utilization ascending as the tiebreaker. The 7-day reset deadline for a given spawn is read from the per-model weekly limit entry in `modelWeeklyLimits` matching the model that will be used (`seven_day_sonnet`, `seven_day_opus`, or the generic `seven_day`); when no model-specific or generic `seven_day` entry exists but the cache snapshot recorded a non-expired top-level `anthropic-ratelimit-unified-7d-reset` deadline, that header value is bridged into a synthesized generic `seven_day` entry whose `rejected` flag matches the (non-expired) `anthropic-ratelimit-unified-7d-status` rejection. When neither source supplies a deadline, the token is treated as having an infinite deadline and sorts last. Each token's per-run concurrent preparation slot count is determined by both its 5-hour and 7-day utilization, taking the more restrictive (minimum) of the two so concurrency ramps down as either window fills: for each window, at or below 80% the token receives the full six concurrent slots; above 80%, the slot count is reduced proportionally — specifically `ceil(6 × (1 − util) / 0.2)` — with a minimum of 1 slot at any utilization level, so near-exhausted tokens still participate rather than being cut off entirely. The final slot count is the minimum of the 5-hour-derived and 7-day-derived counts, multiplied by the token's `selectionWeight` and rounded down, with a minimum of 1 slot at any weight. A token configured with `selectionWeight: 0.8` therefore receives four concurrent preparation slots where an unweighted token receives six, so a token the operator wants held in reserve is given proportionally less preparation concurrency instead of the full amount. Before each `aw` spawn, among the tokens that still have an available slot (slot count minus the in-flight count minus the count already spawned this run, greater than zero), the token whose 7-day reset is soonest is selected; in-flight slot count from prior runs no longer routes new work away from a soon-reset token, so a soon-reset token's slots are filled before a later-reset token receives any, and remaining slot count is used only as the tiebreaker when two candidates share the same 7-day reset. The in-flight count is read from `/proc`: a process is counted against a token only when its environment exports that token as `CLAUDE_CODE_OAUTH_TOKEN`, its command line contains the preparation worker marker `Take ownership`, and no ancestor process already counted for the same token. An interactive Claude Code session started by a human with the same token in its environment is therefore not counted, because it is not a preparation worker; counting such sessions made a token look saturated and pushed preparation work onto the tokens the operator intended to hold in reserve. The effective preparation limit for a run is the lesser of the sum of all eligible tokens' slot counts and the explicit `maximumPreparingIssuesCount` (which defaults to 6). When a token list is configured but no eligible token remains after filtering, preparation is skipped for that run. The selected token and the proxy URL (`http://127.0.0.1:8787`) are passed to the child `aw` process as `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_BASE_URL` environment variables. The child inherits the parent process's environment, so no further wiring is required inside `aw`.

When `claudeCodeOauthTokenListJsonPath` is unset, no proxy is started and `aw` runs with whatever `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_BASE_URL` are already in the environment.

### Console Server Auto-start

When `consoleAccessToken` is set, `startDaemon` automatically starts the console server before the first preparation cycle. The mechanism mirrors the rate-limit proxy: at the start of each `startDaemon` run, the daemon TCP-probes port 9980 (`DEFAULT_WEB_PORT`). If nothing responds, it spawns a detached child process running `serveWeb` on that port, passing the same `--configFilePath` and `--port` arguments. The spawned process is detached from the daemon so it persists across daemon runs. SIGTERM and SIGINT sent to the daemon are forwarded to the console server child process, after which the daemon exits.

When `consoleAccessToken` is unset, no console server is started automatically; `serveWeb` must be started manually if needed.

### Slack User Token

#### scope

- channels:read
- groups:read
- mpim:read
- im:read
- chat:write
- identify
- usergroups:read
- users:read
- files:write
- files:read

## Project ID Cache

The mapping from `owner/projectNumber` to the immutable GitHub Project node ID that `GraphqlProjectRepository.fetchProjectId` resolves is cached on disk so it is shared across processes, and so is the reverse mapping from that node ID back to the owner, owner type and project number. Because every TDPM invocation is a fresh process, an in-memory cache alone would re-resolve these mappings on every loop and every worker start. The cache reuses the same `${XDG_CACHE_HOME:-$HOME/.cache}/tdpm/cache/{projectName}/` directory convention as the issue cache and writes each entry atomically (to a `.tmp` file then renamed) so concurrent processes never corrupt or read a partial file.

```
${XDG_CACHE_HOME:-$HOME/.cache}/tdpm/cache/{projectName}/projectId-{owner}:{projectNumber}/{timestamp}.json
${XDG_CACHE_HOME:-$HOME/.cache}/tdpm/cache/{projectName}/projectLocation-{projectId}/{timestamp}.json
```

- The `projectId` mapping (`owner/projectNumber` to project node ID) is permanently static, so it is reused with no time-to-live.
- The `projectLocation` mapping (project node ID to `{owner, ownerType, projectNumber}`) is the same mapping read the other way round and is equally static, so it too carries no time-to-live. It exists because the Projects V2 REST routes are addressed by owner and project number while the code passes the project node ID around. It is written whenever either direction becomes known: when `fetchProjectId` resolves a project URL, and when a cold start GraphQL read of the project returns the project URL.
- Only these immutable mappings are cached. Project metadata that can change — the project's fields and single-select status and story options resolved by `getProject` — is intentionally not cached on disk and is fetched fresh on every call, so newly created status and story options are never missed. With the location known, `getProject` and `listFieldNames` read that fresh metadata from the Projects V2 REST endpoints (`GET /{ownerType}/{owner}/projectsV2/{projectNumber}` and `.../fields`), which spend the core rate-limit budget instead of GraphQL points; the GraphQL project query remains as the cold start path for the first read in a workspace.
- A malformed or absent cache file falls back to a live GraphQL fetch and never crashes, and a read or write failure of either cache is logged rather than swallowed, because a silently failing write would send every later process back to the GraphQL path with no signal.
- A recorded location can still go stale if the owner is renamed. When the REST read returns 404 the entry is discarded, the project is re-read over GraphQL, and the corrected location is written back, so a rename recovers by itself on the next read.

## Per-Project Situation Snapshot

After each schedule cycle, TDPM writes a per-project situation snapshot to:

```
${XDG_CACHE_HOME:-$HOME/.cache}/tdpm/cache/{projectName}/situation-{projectId}.json
```

This file is written atomically (written to a `.tmp` file then renamed) so external readers never see a partial write.

### JSON Shape

```json
{
  "capturedAt": "2025-01-01T00:00:00.000Z",
  "config": {
    "maximumPreparingIssuesCount": 6,
    "utilizationPercentageThreshold": 90,
    "thresholdForAutoReject": 3
  },
  "status": {
    "awaitingQualityCheckImmediatelyActionable": 2,
    "preparation": 4,
    "awaitingWorkspaceImmediatelyActionable": 3,
    "awaitingWorkspaceBlockedByDependency": 1,
    "failedPreparation": 2
  },
  "processes": {
    "runningPreparation": 4
  },
  "system": {
    "memory": {
      "usedPercent": 45.2,
      "usedGib": 7.25,
      "totalGib": 16.0
    },
    "swap": {
      "usedPercent": 25.0,
      "usedGib": 1.0,
      "totalGib": 4.0
    }
  }
}
```

### Field Descriptions

- `capturedAt`: ISO 8601 timestamp when the snapshot was captured.
- `config.maximumPreparingIssuesCount`: Resolved maximum number of issues allowed in preparation status (`null` if unconfigured).
- `config.utilizationPercentageThreshold`: Resolved 5-hour utilization hard threshold (percentage). Tokens at or above this value are excluded from rotation.
- `config.thresholdForAutoReject`: Resolved consecutive rejection count before auto-escalation.
- `status.awaitingQualityCheckImmediatelyActionable`: Count of issues in the awaiting quality check status with no dependency URL, next action date, or next action hour set.
- `status.preparation`: Count of issues currently in preparation status.
- `status.awaitingWorkspaceImmediatelyActionable`: Count of issues in awaiting workspace status with no dependency URL, next action date, or next action hour set.
- `status.awaitingWorkspaceBlockedByDependency`: Count of issues in awaiting workspace status that have a dependency URL set.
- `status.failedPreparation`: Count of issues currently in failed preparation status.
- `processes.runningPreparation`: Count of spawned preparation processes confirmed running via `preparationProcessCheckCommand`. `null` if `preparationProcessCheckCommand` is not configured.
- `system.memory.usedPercent`: Host memory usage as a percentage (MemTotal - MemAvailable / MemTotal × 100).
- `system.memory.usedGib` / `system.memory.totalGib`: Used and total host memory in GiB.
- `system.swap.usedPercent`: Host swap usage as a percentage.
- `system.swap.usedGib` / `system.swap.totalGib`: Used and total host swap in GiB.

System metrics are read from `/proc/meminfo` at snapshot write time.

## Per-Project Console Lists

When `consoleDataOutputDir` is configured, each schedule cycle writes the full per-tab Console list files from the in-memory project and issue data already loaded for the cycle (no additional GitHub API calls). Additionally, `notifyFinishedIssuePreparation` immediately patches the relevant tab files on disk when it transitions an issue's status, so the console reflects the new status without waiting for the next scheduled cycle.

```
{consoleDataOutputDir}/{projectName}/{tab}/list.json
```

for `tab` in `workflow-blocker`, `prs`, `triage`, `unread`, `failed-preparation`, `todo-by-human`, and `todo-by-agent`. Each file is written atomically (written to a `.tmp` file then renamed) so external readers never see a partial write. When `consoleDataOutputDir` is unset the generation is skipped, and any error during generation is logged and swallowed so the schedule cycle is never affected.

### Item Selection

Most tabs apply a common actionable filter to the project's issues: the issue is open, is assigned to the project manager, has no depended issue URLs, and has neither a next action date nor a next action hour set. Each tab then applies its own selector:

- `prs`: status equals `Awaiting Quality Check` (case-insensitive)
- `unread`: status equals `Unread` (case-insensitive)
- `failed-preparation`: status equals `Failed Preparation` (exact case)
- `todo-by-human`: status equals `Todo by human` or the legacy value `Todo` (exact case)
- `todo-by-agent`: status equals `Todo by agent` (exact case)
- `triage`: every open issue assigned to the console owner whose story field is empty or whose story name contains `no story` (case-insensitive), the two being the same operational state because the `NO STORY` option is what this tool assigns to an issue that has none, whatever status it carries, whatever it depends on and whatever next action date or hour it holds, because the `NO STORY` story option is assigned by this tool rather than chosen by a person, so the triage decision stays open however far the status has advanced and however the issue is blocked or scheduled. Pull requests are excluded, because a pull request's story is written by this tool from its task issue. This tab is the one tab built from the full issue list rather than from the shared actionable set, so `In Tmux by agent` is listed here while every other tab drops it

The `workflow-blocker` tab is the one exception to the common actionable filter: it lists every issue whose story name equals the configured `workflowBlockerStoryName` (case-insensitive) and whose issue state is not closed, regardless of its status, next action date, next action hour, or depended issue URLs. When `workflowBlockerStoryName` is unset, the `workflow-blocker` list is always empty.

### JSON Shape

The `workflow-blocker`, `prs`, `unread`, `failed-preparation`, `todo-by-human`, and `todo-by-agent` tabs share this shape:

```json
{
  "pjcode": "my-project",
  "generatedAt": "2026-06-14T07:22:33Z",
  "statusOptions": [
    { "id": "...", "name": "Awaiting Workspace", "color": "BLUE" }
  ],
  "storyOrder": ["Story Alpha", "Story Beta"],
  "storyColors": { "Story Alpha": { "color": "BLUE" } },
  "items": [
    {
      "number": 1,
      "title": "Example",
      "url": "https://github.com/owner/repo/issues/1",
      "repo": "owner/repo",
      "nameWithOwner": "owner/repo",
      "projectItemId": "...",
      "itemId": "...",
      "isPr": false,
      "story": "Story Alpha",
      "labels": ["bug"],
      "createdAt": "2026-06-13T08:18:45.000Z"
    }
  ]
}
```

The `triage` tab omits `statusOptions`, adds `storyOptions` (all story field options), and uses plain color string values in `storyColors` (for example `"Story Alpha": "BLUE"`).

### Field Descriptions

- `pjcode`: The configured project name.
- `generatedAt`: UTC timestamp (no milliseconds) when the lists were generated. Item `createdAt` values keep milliseconds.
- `statusOptions`: Project status field options offered as routing buttons. The current-status option and `Done` are excluded; `failed-preparation` additionally excludes `Preparation`, `Icebox`, `Unread`, `In Tmux by human`, `In Tmux by agent`, and `Todo by agent`.
- `storyOptions` (triage tab only): All story field options.
- `storyOrder`: Story field option names in field order (empty array when the project has no story field).
- `storyColors`: Map from story name to its color. Object value (`{ "color": ... }`) for `workflow-blocker`/`prs`/`unread`/`failed-preparation`/`todo-by-human`/`todo-by-agent`; plain string value for `triage`.
- `items`: Selected issues, stable-sorted by their story's position in `storyOrder` (unknown stories sorted last). No item carries a `body` field.

## In-Tmux-by-Human Data

When `inTmuxDataOutputDir` is configured, each schedule cycle also writes the in-tmux-by-human data files for the current project, generated from the same in-memory project and issue data already loaded for the cycle (no additional GitHub API calls). Each file is written atomically (written to a `.tmp` file then renamed) so external readers never see a partial write. When `inTmuxDataOutputDir` is unset the generation is skipped, and any error during generation is logged and swallowed so the schedule cycle is never affected.

### Item Selection

An issue is selected when its status equals `In Tmux by human` (exact match), it is open, and its assignees include the project manager. Selected issues are grouped by their story value (a null story maps to the empty string). Groups are ordered by the project story option display order; a group whose story is not among the story options is placed at the tail, ordered by the story string. Within a group, issues keep their input order.

### Files

For the current project code `{pjcode}` (the configured `projectName`):

```
{inTmuxDataOutputDir}/{pjcode}.json       # v1: [{ story, urls: string[] }]
{inTmuxDataOutputDir}/{pjcode}.v2.json    # v2: [{ story, urls: [{ url, title }] }]
{inTmuxDataOutputDir}/{pjcode}.v3.json    # v3: { version, overviewUrl, tdpmConsoleUrl, groups: [{ story, urls: [{ url, title }] }] }
{inTmuxDataOutputDir}/{pjcode}.v4.json    # v4: { version, overviewUrl, tdpmConsoleUrl, newIssueUrl, groups: [{ story, sessions: [{ name, description }] }] }
{inTmuxDataOutputDir}/{pjcode}.v5.json    # v5: v4 plus, on every session, unansweredCalls: [{ calledAt, body }]
```

and the cross-project index files:

```
{inTmuxDataOutputDir}/index.json          # { projects: string[] }
{inTmuxDataOutputDir}/index.v2.json       # { version: 2, projects: string[] }
{inTmuxDataOutputDir}/index.v3.json       # { version: 3, projects: string[] }
{inTmuxDataOutputDir}/index.v4.json       # { version: 4, projects: [{ name, path }] }
{inTmuxDataOutputDir}/index.v5.json       # { version: 5, projects: [{ name, path }] }
```

The index files list every project in `inTmuxProjectOrder` whose `{name}.json` already exists in the output directory, so successive per-project schedule cycles incrementally build the same shared index. In `index.v4.json` and `index.v5.json`, each `path` is `/{basename of inTmuxDataOutputDir}/{name}.v4.json?k={token}` and `/{basename of inTmuxDataOutputDir}/{name}.v5.json?k={token}` respectively.

### Unanswered Owner Calls (v5)

Every session of the v5 document carries `unansweredCalls`, the owner calls that session has raised and the owner has not answered, oldest first. Each entry has `calledAt`, the ISO 8601 UTC time at which the call was raised, and `body`, the text of the message that raised it. `calledAt` is the identity of a call: two calls carrying the same text are distinguished by their time. A session with nothing outstanding carries an empty array.

The calls are read from the live session transcripts, so they require `ownerCallMarker` (or `TDPM_SILENT_OWNER_CALL_MARKER`) to be configured; without it every session carries an empty array. A session is keyed by its tmux session name, derived from the issue URL exactly as the in-tmux session reconciler derives it.

### Field Descriptions

- `overviewUrl`: The GitHub Project board URL, taken from the project `url`.
- `tdpmConsoleUrl`: `{inTmuxConsoleBaseUrl}/projects/{pjcode}`. The v4 variant appends `?k={token}`. The v3 and v4 files are skipped when `inTmuxConsoleBaseUrl` is unset.
- `newIssueUrl` (v4 only): `https://github.com/{org}/{newIssueRepo ?? workingReport.repo}/issues/new?assignees={manager}`, derived from existing config values. The repo segment uses the optional `newIssueRepo` config value when set, otherwise it falls back to `workingReport.repo`; `newIssueRepo` overrides only this url and nothing else.
- `groups`: Story groups. The v3 `groups` carry a `urls` array using the v2 `{ url, title }` entry shape. The v4 `groups` use tmux terminology: each group carries a `sessions` array and each session is `{ name, description }` where `name` is the GitHub issue URL and `description` is the issue title.
- Token handling: The v4 per-project file and `index.v4.json` are skipped when `inTmuxConsoleToken` is unset. The token value is never written to source code, tests, or documentation; it is supplied through configuration only.

### Session Restart Reconciler

When `inTmuxLauncherCommand` is configured, each schedule cycle also reconciles the interactive sessions for `In Tmux by human` issues so that those sessions keep running. The same issues selected for the data files above (status `In Tmux by human`, open, assigned to the project manager) are checked for liveness, and any whose session is missing is restarted.

A session is considered live for an issue only when both of the following hold: a tmux session named after the issue URL exists, and a running process advertises the issue URL on its command line. The tmux session name is the issue URL with every non-alphanumeric character replaced by an underscore.

For each `In Tmux by human` issue with no live session, the reconciler launches a new detached tmux session named after the issue URL that runs `{inTmuxLauncherCommand} {issueUrl}`. Process and tmux inspection and session launching are performed through injectable ports, so the reconciliation logic is unit-testable without touching the host. When `inTmuxLauncherCommand` is unset the reconciler is skipped, and any error during reconciliation is logged and swallowed so the schedule cycle is never affected.

## Silent Live Session Notification

Each schedule cycle, when `silentNotificationEnabled` is true, also inspects every live interactive Claude Code session and sends a short self-check reminder into a session via `tmux send-keys` when either of two independent conditions holds. The reminder is composed of only the sections whose condition is met. The main-session-stalled section and the sub-process section are independent, and within the sub-process section the idle (no-output) condition and the long-running condition each produce their own distinct message so a small idle time is never lumped together with a long running time; a sub-process that matches both conditions is reported in both messages, kept separate. When `silentNotificationEnabled` is not set, the entire step is a no-op even if the daemon picks up its configuration automatically.

Candidate sessions are first selected from the live process tree: every live tmux session is taken, the descendants of each session's pane processes are walked, and the first descendant that is an interactive Claude Code process (its command line contains `claude` and does not contain the owner-handover marker `Take ownership of`, and its environment exposes both `CLAUDE_CODE_SESSION_ID` and `CLAUDE_CONFIG_DIR`) is taken as that session's process. Because the walk is anchored on tmux panes, background owner-handover spawns, the preparation daemon, and monitor processes — none of which run inside an interactive tmux pane — are excluded; the owner-handover marker check is an additional guard. The monitor then acts on a session when it is either named after a `github.com` issue or pull-request URL — that is, a name of the form `https_//github_com/{owner}/{repo}/issues/{N}` or `https_//github_com/{owner}/{repo}/pull/{N}` (the form tmux derives from the raw issue/PR URL by replacing only `.` and `:` with `_`; the raw `https://github.com/...` form is matched as well) — or has a resolvable Claude agent transcript on disk. The resolvable transcript is the proof that the session is a live Claude agent session, so role-named resident leader and project-manager agent sessions (for example `app`, `tdpm-cli`, `secretary`, and the per-project `*pm` sessions) are monitored and receive the main-stall reminder even though their names encode no issue or pull-request URL. Gating this broadened inclusion on the resolvable transcript rather than on merely being a tmux session keeps genuine non-agent interactive sessions excluded: a login shell, or a viewer such as `sso_login` or a `tdpm` viewer, exposes no Claude transcript on disk, so it is left untouched — it receives neither a main-stall nor a sub-process notification — and the count of interactive sessions ignored each cycle, those that are neither github-named nor have a resolvable transcript, is logged. A role-named leader or PM session encodes no `github.com` hub task, so the hub-task active-status gate described below treats it as active and does not suppress it. Each interactive session's transcript is resolved by scanning the `projects/<cwd-slug>/` subdirectories of two roots — the per-session `<CLAUDE_CONFIG_DIR>/projects/` and the shared `~/.claude/projects/` — for a `<sessionId>.jsonl` file named by any of the session's candidate session ids. The candidate ids are derived from the process tree, in priority order: the current session id recorded in `<CLAUDE_CONFIG_DIR>/sessions/<pid>.json` (the session id rotates on resume or compaction, and this record holds the current value), then the interactive process's own launch id from the `CLAUDE_CODE_SESSION_ID` environment variable, then the distinct ids propagated to its descendant processes, all deduped. Searching the shared root and the rotated current id is required because, for a resumed or compacted session, the actively-written transcript is named by the current id and lives under the shared root rather than under the per-session config directory; the descendant-propagated ids are required because, for a session started without `--resume`, the own launch id names no transcript on disk and the live transcript is named by the descendant id. The candidate ids are tried strictly in this priority order, and the first candidate id that names an existing `<sessionId>.jsonl` file in either root is selected; the most recently modified match is used only as a tiebreak when that same id exists in both roots. Resolving by candidate-id priority rather than by the globally most recently modified file across all candidate ids is required because a session running a sub-agent has the sub-agent's own transcript on disk too, and that sub-agent transcript can be more recently modified than the parent session's transcript while not naming the parent. The parent session's own ids (the rotated current id and the launch id) come before any descendant-propagated id, so the parent's own transcript is selected ahead of a sub-agent transcript; a sub-agent transcript, which lives under `projects/<cwd-slug>/<parentSessionId>/subagents/agent-<id>.jsonl` rather than as a top-level `<sessionId>.jsonl` file, is never reached. This way a non-resume session and a session that has no issue URL both resolve just as reliably as a resume, issue-url-named one, and a session that is waiting on the owner while a sub-agent runs is evaluated against its own transcript rather than the sub-agent's.

The main-session stalled section is sent when the session's main output has been idle for at least `mainSilentThresholdSeconds`, unless the session is currently waiting on the owner (in that case the silence is expected and the section is suppressed). Idle time is computed from the timestamp of the latest entry of any kind in the session's resolved transcript rather than from the transcript file modification time, so a session that keeps appending tool results, owner replies, or any other entry type while emitting no assistant text still counts as active and is not mistaken for a silent one. Whether a session is waiting on the owner is determined through an injectable port; the built-in default reports no session as waiting, so the suppression is only applied when a host provides an implementation. When `ownerCallMarker` is configured, a transcript-based implementation is used: it reads each session's resolved transcript and treats the session as waiting on the owner when the latest entry containing any member of the configured marker's tag family is newer (by full timestamp) than the latest genuine owner reply. The tag family is the configured `ownerCallMarker` itself plus, when that marker ends with `>`, its candidate form obtained by replacing the trailing `>` with `-pending>`. This matters because an agent raises the owner call with the candidate tag and only the promoted tag is rendered to the terminal, so the transcript may carry the candidate form alone; matching the whole family keeps a genuinely waiting session suppressed regardless of which form its transcript records. A self-check reminder that the monitor injects into a session via `tmux send-keys` itself lands in that session's transcript as a `user` text entry; every injected reminder carries a fixed sentinel tag (`[TDPM_SILENT_SESSION_SELF_CHECK_REMINDER]`), and a `user` entry whose text contains that sentinel is not counted as a genuine owner reply. This prevents the monitor's own reminder from being mistaken for the owner answering, which would otherwise make a genuinely waiting session stop being suppressed. The stalled section's fourth self-check point directs the agent to resume the assigned work by taking its next concrete step and to report the result of that step in its next output, and states that a period without output means the assigned work is not progressing and is therefore not by itself a reason to contact the owner. The section solicits no owner-call, because a session that has produced no output has not finished anything to report, and a reminder that asks for a message can be discharged by emitting text while the work stays where it was. Owner-call guidance is confined to the stale-owner-call section, where a call already exists and has gone unanswered.

The waiting-on-the-owner suppression is unconditional: whenever the session's latest owner call is newer than its latest genuine owner reply, the main-session stalled section is suppressed with no age or grace expiry, because the persistent unread indicator in the owner's app already covers a missed call. `unansweredOwnerCallGraceSeconds` (default 3600) is retained only for backward compatibility of the configuration surface and is no longer consulted, so the stale-owner-call reminder variant and its `silentMainStalledStaleOwnerCallMessage` override are currently never composed. The transcript-based owner-call detection still exposes the epoch timestamp of the latest unanswered owner call per session.

The sub-process section is sent, regardless of main output, when at least one sub-process of the session has been output-idle for `subAgentSilentThresholdSeconds`, has been running for `subAgentRunningThresholdSeconds`, or has finished while its result stayed unconsumed for `subAgentSilentThresholdSeconds`. It is composed of up to three distinct messages, one per condition: an idle message that lists each sub-process that produced no output for at least `subAgentSilentThresholdSeconds` with its no-output minutes, tells the agent to treat that system-detected idle duration as the authoritative signal rather than re-deriving whether the sub-process is alive, forbids dismissing the signal from speculation, and requires the agent to determine the cause by a concrete check (whether there is genuinely no recent activity anywhere, including a very recent push or commit or output from nested sub-processes it started, versus being legitimately blocked on an external dependency such as a continuous-integration run, an external API, or another process), to act if stuck or state the waiting conclusion with concrete evidence if waiting, and to output that investigation result into the session as a log even though owner notification is not required, and a long-running message that lists each sub-process that has been running for at least `subAgentRunningThresholdSeconds` with its running minutes and asks the agent to verify it is genuinely advancing rather than caught in an infinite loop, a task that is too large, or a stuck approach. The long-running message foregrounds the running duration and does not surface the short idle time, so a sub-process flagged only for running long is not dismissed because its silent time looks small; a sub-process that matches both conditions appears in both messages. The long-running threshold is overridable per project via `subAgentRunningThresholdSeconds` (default 900 seconds) for repositories whose continuous integration legitimately runs longer. The third message is the unconsumed-result message: it lists each finished sub-process whose result has been waiting unread for at least `subAgentSilentThresholdSeconds` with the whole minutes it has been waiting, and asks the agent to read that result, act on it, and then mark the sub-process finished so it is no longer tracked as running. A finished sub-process is recognized as unconsumed while it is still listed in the harness running set, because the leader removes that record line once it has acted on the completion, and its waiting time is the age of the last transcript write. This condition is evaluated independently of main-session silence, so a leader that keeps producing output while a finished sub-process result sits unread is still reminded. A finished sub-process never appears in the idle or long-running messages; those two remain restricted to sub-processes that are still working. Sub-processes are discovered in one of two ways: when `subAgentTranscriptRootDirectory` is configured, each session's `subagents/agent-<id>.jsonl` transcripts are scanned. The sub-agent directory is the `subagents/` directory that sits next to the session's already-resolved main-session transcript file under `projects/<cwd-slug>/<sessionId>/subagents/`, derived by stripping the `.jsonl` suffix from the main-session transcript path and appending `subagents`; this on-disk path is keyed by the session's working-directory slug and session id, not by the tmux session name. Whether a sub-agent has finished is determined from the last meaningful transcript entry rather than from the last non-null `stop_reason` seen anywhere in the file. A sub-agent is treated as finished when its last entry is a completion or termination marker: an assistant message whose `stop_reason` is `end_turn` or `stop_sequence`, an assistant message whose final content block is `text` (a final answer returned to the parent, which Claude Code often writes with a `null` `stop_reason`), a user message whose final content block is `text` (a terminal user entry such as `[Request interrupted by user]`), a user message whose final content block is the `tool_result` of a `StructuredOutput` tool call (the structured output the sub-agent delivered as its final answer), or a user message with no content blocks. Only a sub-agent whose last entry is an assistant message with a pending `tool_use` block and no following tool result is still considered active and subject to the idle and running thresholds; this is the genuinely-incomplete shape — the sub-agent requested a tool that never returned and is hung mid-work. A plain trailing `tool_result` (from any tool other than `StructuredOutput`) is not treated as a completion marker, because a live agent alternates between pending `tool_use` and `tool_result` entries as tools complete; treating it as terminal would make an active agent flap in and out of the snapshot. Idle time is taken from the transcript file modification time (following symlinks) while running time is taken from its first entry timestamp. Two positive signals drop a sub-agent outright: a parent-transcript task notification whose `<status>` is a terminal value (`completed`, `killed`, `stopped`, or `failed`) drops every `<task-id>` it lists, and, when `subAgentRuntimeRootDirectory` is configured, a process-liveness gate drops any sub-agent id absent from the harness running set (`running-subagents.txt`). A sub-agent that survives both signals and whose transcript ends in a completion or termination marker is the unconsumed-result case: it is still listed in the running set, so it is retained and reported with its completion state and the age of its last transcript write instead of being discarded, which is what lets the unconsumed-result message be composed. When the running set cannot be read at all, the completion marker alone excludes the sub-agent, because an unconsumed result cannot be distinguished from an already-cleared one without that set. There is no age cap: a sub-agent that is past the idle or running threshold and does not end in a completion or termination marker is flagged regardless of how long it has been silent, so a genuinely-stuck sub-agent that has been hung on a pending tool call for hours or days is still reported instead of being silently dropped. Otherwise sub-processes are discovered by matching `subAgentProcessMatchPattern` against process command lines. Because a sub-agent inside a single blocking call (for example a continuous-integration watch) is otherwise indistinguishable from a hung one, the transcript-based discovery additionally judges the sub-agent's actual wait state instead of applying any time-window suppression. A sub-agent whose transcript tail is an in-flight tool call — the last entry is an assistant tool-use with no following tool result — carrying a command string is classified as WAITING when a live process matching that command exists on the host: each pending tool command is normalized (whitespace collapsed, first 60 characters) and searched as a substring of the normalized host process command lines (`ps -eo etimes=,args=`, supplied through the injectable process lister). A WAITING sub-agent never produces an idle (no-output) reminder, no matter how long its transcript has been silent. The long-running message is selected on elapsed running time alone and is not affected by either signal: a sub-process that keeps producing output, and a sub-process classified as WAITING on a live external process, are both still reported once they pass `subAgentRunningThresholdSeconds`, because producing output and waiting on a long external command are exactly the states a genuinely long-running sub-process is normally in. This selection is also independent of whether the main session is silent, so a leader that is actively working is still told how long each of its sub-processes has been running. A sub-agent whose in-flight tool call has no matching live process is genuinely hung and its session is re-selected as a candidate on every qualifying cycle. A session that stays a candidate is re-injected on every qualifying cycle: there is no per-episode cap, so a session with a persistent sub-process advisory, and a session whose main output stays silent, are both reminded again each cycle until the condition clears. Main-session stall detection behavior is otherwise unchanged.

A two-consecutive-cycle debounce guards against transient false positives: a session is notified only when it meets the silent-target condition (output silent at or beyond the threshold and not waiting on the owner) in the current cycle and it was also a notification candidate in the immediately previous cycle. The set of candidate session names is persisted across cycles, keyed by the globally-unique session name, in a state file written atomically (the default path is `${XDG_CACHE_HOME:-~/.cache}/tdpm/silent-session-candidates.json`, overridable via `candidateDebounceStateFilePath`). The monitor runs as a fresh process each schedule cycle, so this on-disk state is what carries the previous cycle's candidate set forward. Each cycle loads the candidate set recorded within `candidateDebounceRecencyWindowSeconds` of now (default 900, a small multiple of the schedule interval to tolerate interval jitter), then records the current candidate set with the current timestamp; entries that age past the retention window are dropped on the next save, and a save merges with other recently-recorded session names so concurrent per-project runs do not clobber each other. A candidate that appears for only one isolated cycle — for example because the owner's reply has not yet been flushed to the transcript when the monitor reads it, or because a transient hub-task status resolution error fails open for a single cycle — is therefore deferred and never notified, while a genuine stall that persists across cycles is still caught, one cycle later. Because silence is measured from the latest transcript entry of any type — including the monitor's own injected reminder and the owner's reply — a notified session's measured silence resets as soon as it produces any activity, so a session that has resumed is not re-flagged. When more than one session is notified in the same cycle, the sends are spaced out sequentially with `silentNotificationStaggerSeconds` between consecutive sends (no wait before the first or after the last) so the targets are not all triggered at once. When `activeHubTaskStatus` is configured, each notification is gated on the latest GitHub state and Project Status of the session's hub task: a session whose name identifies a github.com issue or pull request — accepted both as a clean `https://github.com/{owner}/{repo}/issues/{N}` URL and as the real tmux session-name form `https_//github_com/{owner}/{repo}/issues/{N}` produced by replacing `.` and `:` with `_` (the `pull` path is accepted in both forms too) — is notified only while that hub task is open and in the configured active Status, so a session whose hub task has been closed, merged, or moved to another Status (for example Done) is suppressed; sessions whose name does not identify a github.com issue or pull request are never gated. To cut GitHub query load and remove most fail-opens, each resolved status is cached by issue URL in a state file written atomically (the default path is `${XDG_CACHE_HOME:-~/.cache}/tdpm/silent-session-hub-task-status.json`, overridable via `hubTaskStatusCacheStateFilePath`). On each cycle the gate reads the cache first: a cached entry recorded within `hubTaskStatusCacheTtlSeconds` of now (default 300) decides the gate without any GitHub query, and otherwise the hub task is re-resolved and the result written back to the cache. When live resolution fails — the resolver returns no tracked task (a closed or Done issue filtered out of the active project), or a transient API error is thrown — the gate falls back to the cached status even after it has expired: a cached active entry keeps the notification (still notified if genuinely stalled) and a cached closed or non-active entry suppresses it, each logged with a distinct warning. Only when there is no cached status at all and live resolution fails does the gate fail open once (a closed issue and a transient error are indistinguishable in that case without an extra network call), logging a distinct warning, so the next cycle can populate the cache. When `activeHubTaskStatus` is unset, this hub-task check is a no-op. Process-snapshot collection, transcript resolution, owner-call detection, the wait between sends, and the message wording are all performed through injectable ports, so the logic is unit-testable without touching the host, and the host-specific process and environment access, sub-process pattern, and message wording are supplied through adapters or configuration. When `silentNotificationEnabled` is not true the step is a no-op, and any error during the step is logged and swallowed so the schedule cycle is never affected.

Each config key above has a matching environment variable read when the config key is unset: `TDPM_SILENT_NOTIFICATION_ENABLED` (the string `true` enables the step), `TDPM_SILENT_OWNER_CALL_MARKER`, `TDPM_SUBAGENT_OUTPUT_ROOT_DIRECTORY`, `TDPM_SUBAGENT_PROCESS_MATCH_PATTERN`, `TDPM_SUBAGENT_TRANSCRIPT_ROOT_DIRECTORY`, `TDPM_SUBAGENT_RUNTIME_ROOT_DIRECTORY`, `TDPM_MAIN_SILENT_THRESHOLD_SECONDS`, `TDPM_SILENT_UNANSWERED_OWNER_CALL_GRACE_SECONDS`, `TDPM_SUBAGENT_SILENT_THRESHOLD_SECONDS`, `TDPM_SUBAGENT_RUNNING_THRESHOLD_SECONDS`, `TDPM_SILENT_NOTIFICATION_STAGGER_SECONDS`, `TDPM_SILENT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS`, `TDPM_SILENT_CANDIDATE_DEBOUNCE_STATE_FILE_PATH`, `TDPM_ACTIVE_HUB_TASK_STATUS`, `TDPM_SILENT_HUB_TASK_STATUS_CACHE_STATE_FILE_PATH`, `TDPM_SILENT_HUB_TASK_STATUS_CACHE_TTL_SECONDS`, `TDPM_SILENT_MAIN_STALLED_MESSAGE`, `TDPM_SILENT_MAIN_STALLED_STALE_OWNER_CALL_MESSAGE`, `TDPM_SILENT_SUBAGENT_IDLE_MESSAGE_HEADER`, `TDPM_SILENT_SUBAGENT_IDLE_MESSAGE_FOOTER`, `TDPM_SILENT_SUBAGENT_LONG_RUNNING_MESSAGE_HEADER`, and `TDPM_SILENT_SUBAGENT_LONG_RUNNING_MESSAGE_FOOTER`.

Each schedule cycle, when `outputDegenerationResetEnabled` is true, also inspects every live interactive Claude Code session named after a github.com issue or pull-request URL and resets a session whose output has collapsed into a repeat loop. A session is detected as degenerated when either of two independent conditions holds. The intra-turn condition looks at the session's most recent assistant turn and fires on any of three signatures: the longest consecutive run of an identical short token (at most 32 characters) is at least 5 and dominates at least 0.8 of the turn's tokens; or, after fenced code blocks, table rows, and list items are removed, an absolute consecutive run reaches at least 15 identical short tokens; or the duplicated 4-gram density of the filtered turn is at least 0.3 over at least 40 tokens. The cross-turn condition looks at the last 10 assistant turns and fires when the same isolated short purely-alphabetic trailing token recurs as the appended token in at least 4 of them. These thresholds are ported unchanged from the empirically-validated standalone monitor: healthy sessions never exceed 2 to 3 consecutive repeats of a single token in one turn and end turns with varied content, so both conditions have measured zero false positives. When a session is detected, a checkpoint warning is sent via `tmux send-keys`, the grace period is awaited, and the tmux session is killed so it is relaunched fresh; a per-session cooldown (default 300 seconds) prevents re-resetting the same session before its fresh relaunch completes. When `outputDegenerationResetEnabled` is not true the detection still runs and logs what it would do, but no warning or kill is performed, and any error during the step is logged and swallowed so the schedule cycle is never affected. Each config key above has a matching environment variable read when the config key is unset: `TDPM_OUTPUT_DEGENERATION_RESET_ENABLED` (the string `true` enables the step), `TDPM_OUTPUT_DEGENERATION_WARNING_MESSAGE`, `TDPM_OUTPUT_DEGENERATION_GRACE_SECONDS`, `TDPM_OUTPUT_DEGENERATION_COOLDOWN_SECONDS`, and `TDPM_OUTPUT_DEGENERATION_COOLDOWN_STATE_FILE_PATH`.

## Token Rotation Order File

After each schedule cycle where Claude OAuth token rotation is active, TDPM writes the computed rotation order to:

```
${XDG_CACHE_HOME:-~/.cache}/tdpm/rotation-order.json
```

This file is written atomically (written to a `.tmp` file then renamed) so external readers never see a partial write.

### JSON Shape

```json
[
  {
    "name": "personal-1",
    "fiveHourUtilization": 0.12,
    "blocked": false,
    "rejected": false,
    "thresholdExcluded": false
  },
  {
    "name": "personal-2",
    "fiveHourUtilization": 0.95,
    "blocked": false,
    "rejected": false,
    "thresholdExcluded": true
  }
]
```

The array is ordered with selected (eligible) tokens first, sorted by ascending `fiveHourUtilization`, followed by excluded tokens. Raw token values are never written to this file; each entry uses the `name` field from the token list JSON as its identifier.

### Field Descriptions

- `name`: Non-secret identifier for the token entry, taken from the `name` field in the token list JSON.
- `fiveHourUtilization`: Current 5-hour utilization ratio (0.0–1.0) for this token.
- `blocked`: `true` if the token is marked as blocked.
- `rejected`: `true` if the token's 5-hour window is rejected (the model-agnostic rejection that excludes the token from rotation regardless of model). The headline unified/representative rejection does NOT set this field, because that status reflects only the most-binding per-model claim and does not exclude a token whose other model windows are still allowed.
- `thresholdExcluded`: `true` if the token is eligible (not blocked, not 5-hour-rejected, not in cooldown, and not weekly-limited for the requested model) but excluded because its 5-hour utilization is at or above the configured threshold, giving it zero available preparation slots.

## Cadence and Cache Contract

The `schedule` command runs two distinct processing loops within a single invocation:

### Fast path (runs every cycle)

The following use cases execute on every `schedule` trigger (cadence is determined by the caller's cron/daemon, typically ~3 minutes):

- `RevertNotReadyReviewQueueIssueUseCase` — handles two review-queue statuses in a single pass:
  - Awaiting Quality Check items: reverts items whose linked PR is conflicting, draft, missing, multiplied, has failing or never-started CI checks, or has unresolved review comments back to awaiting-workspace. For items that have no rejections it also runs the `change-target:<path>` auto-approve check: when the item carries one or more `change-target:` labels and every changed file of the ready PR is confined to the labeled paths, the PR is auto-approved.
  - Unread pull requests: evaluates each open Unread PR for review-readiness using the same criteria above; if the PR is not yet ready, the status is moved to awaiting-workspace and the item's Story is set to "workflow management".
  - Items with an `llm-agent` label are skipped in both loops.
- `RevertOrphanedPreparationUseCase` — reverts orphaned preparation issues back to awaiting-workspace
- `StartPreparationUseCase` — starts preparation for issues ready to be worked on
- `NotifyFinishedIssuePreparationUseCase` — checks preparation-status issues and advances them. When the issue carries one or more `change-target:<path>` labels and all auto status checks pass, the related pull request's full file list is fetched (paginated, no 100-file truncation) and the PR is auto-approved before transitioning to Awaiting Quality Check if every changed file is under at least one of the labeled paths. Matching is boundary-safe (`change-target:foo` matches `foo/bar.ts` but not `foobar/baz.ts`); multiple `change-target:` labels are OR-combined. When no `change-target:` label is present, behavior is unchanged. When the issue carries one or more `change-target-must:<path>` labels, the PR is also rejected with a `CHANGE_TARGET_MUST_PATH_NOT_CHANGED` status when no changed file falls under a required path. The rejection submits a "request changes" review containing an inline comment on the first changed file (or a PR-level comment when the PR has no changed files) that names the required directory. `change-target-must:` paths are also treated as allowed paths for the confinement check, behaving identically to `change-target:` in addition to requiring at least one change under the path. When the last agent comment's first fenced JSON block includes a non-empty `nextStepAgent` string property, the use case adds the label named by that value to the issue (creating the label in the repository if it does not already exist) and transitions the issue to Awaiting Workspace, allowing the next agent identified by the label to pick up the issue automatically.

### Slow path (runs at most once per 600 seconds)

The following use cases run only when at least 600 seconds have elapsed since the last slow sweep:

- `AnalyzeStoriesUseCase`
- `CreateNewStoryByLabelUseCase`
- `ChangeStatusByStoryColorUseCase`
- `UpdateIssueStatusByLabelUseCase`
- `SetWorkflowManagementIssueToStoryUseCase`
- `SetNoStoryIssueToStoryUseCase`
- `AnalyzeProblemByIssueUseCase`
- `ActionAnnouncementUseCase`
- `ClearPastNextActionDateHourUseCase`
- `ClearDependedIssueURLUseCase`
- `CreateEstimationIssueUseCase`
- `ConvertCheckboxToIssueInStoryIssueUseCase`
- `AssignNoAssigneeIssueToManagerUseCase`

The timestamp of the last slow sweep is stored in the `HandleScheduledEvent` Google Spreadsheet sheet (column E, row 2), under the header `LastSlowSweepDateTime`.

### Issue cache contract

On each access the repository chooses between a full fetch (when the cache is absent or stale) and a two-phase, time-precise incremental fetch (when the cache is fresh). The incremental path separates a lightweight day-scan phase from a targeted detail-fetch phase, keeping per-cycle GitHub API usage proportional to the number of items updated since the last fetch rather than proportional to total project size.

The issue repository keeps a single always-latest JSON file per project at `${XDG_CACHE_HOME:-$HOME/.cache}/tdpm/cache/{projectName}/allIssues-{projectId}/latest.json` and refreshes it on access. That base directory is resolved from the user's cache home rather than from the process working directory, so a worker session started inside its own worktree reads the same cache the daemon and every other session write, instead of finding an empty directory and paginating the whole project board again. Each refresh writes the file atomically (to a `.tmp` file then renamed) and records `lastFetchedAt`, `lastFullFetchAt`, the cached `project`, and the `issues` array in the same file.

- When the cache file is missing or its `lastFullFetchAt` is at least one hour old, the repository fetches every project item, replaces the whole issue list, refreshes the cached `project`, and sets both `lastFullFetchAt` and `lastFetchedAt` to now (`cacheUsed` is `false`).
- Otherwise the repository performs a two-phase, time-precise incremental fetch, reusing the cached `project` and setting `lastFetchedAt` to now while leaving `lastFullFetchAt` untouched (`cacheUsed` is `true`). Phase 1 (light day scan): it queries `items(query: "updated:>=<YYYY-MM-DD>")` for the UTC day of the previous `lastFetchedAt` with no previous-day overlap, requesting only each `ProjectV2Item` `id` and `updatedAt` plus the content `url` and `number` (no `fieldValues`), paginating all pages. Because the GitHub ProjectV2 `updated:` filter is day-granular, the results are then filtered client-side to only items whose `ProjectV2Item.updatedAt` is greater than or equal to a cutoff equal to the previous `lastFetchedAt` timestamp minus a small clock-skew buffer (5 minutes), giving time precision while absorbing realistic clock skew between the daemon host and GitHub; the same cutoff date drives the phase-1 query, so the UTC-midnight boundary is handled by construction. The re-included buffer window is idempotent because upserts are keyed by issue URL. Phase 2 (detail fetch): only when that filtered set is non-empty, it fetches the full item detail for those items by node id via `nodes(ids: [...])` in batches of up to 100, converts each to an issue, and upserts them into the cached list keyed by issue URL; when the filtered set is empty phase 2 is skipped entirely.
- Within a single process the refresh runs at most once per project; every subsequent `getAllIssues` call for the same project returns the memoized result, so the many in-cycle reads do not each call GitHub.
- The two-phase incremental fetch (shipped in v1.123.0) is live on the default branch and available via `npm install npm-cli-github-issue-tower-defence-management@latest`.
- `ConvertCheckboxToIssueInStoryIssueUseCase` always fetches the latest story-issue body directly via `getIssueByUrl`, ensuring story bodies are never stale when converting checkboxes to issues.

## Migration Guide

### v1.x → v2.0.0

**Breaking change: `allowedIssueAuthors: null` is now fail-closed**

In v1.x, passing `null` (or omitting) `allowedIssueAuthors` caused `notifyFinishedIssuePreparation` and `checkIssueReviewReadiness` to trust every comment author. In v2.0.0, `null` or an omitted value means no author is trusted — agent reports from any author are rejected.

To preserve the v1.x behavior of processing agent reports, set `allowedIssueAuthors` to an explicit list of trusted GitHub usernames in your config file:

```yaml
startPreparation:
  allowedIssueAuthors:
    - HiromiShikata
```

**Breaking change: unknown `nextStepAgent` values are now rejected**

In v1.x, a `nextStepAgent` value not present in the configured `agents` list was silently accepted and added as a new agent field option. In v2.0.0, when `agents` is configured as a non-empty list, any `nextStepAgent` value not in that list causes the issue to transition to `Failed Preparation` with an error comment.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
