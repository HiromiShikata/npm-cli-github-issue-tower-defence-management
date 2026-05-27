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
  help [command]                        display help for command

Options for schedule:
  -t, --trigger <type>  Trigger type: issue or schedule
  -c, --config <path>   Path to config YAML file
  -v, --verbose         Verbose output
  -i, --issue <url>     GitHub Issue URL

Options for startDaemon:
  --configFilePath <path>                          Path to config file for tower defence management (required)
  --projectUrl <url>                               GitHub project URL
  --defaultAgentName <name>                        Default agent name
  --defaultLlmModelName <name>                     Default LLM model name
  --defaultLlmAgentName <name>                     Default LLM agent name
  --maximumPreparingIssuesCount <count>            Maximum number of issues in preparation status (default: 6 per available Claude OAuth token, otherwise 6)
  --allowIssueCacheMinutes <minutes>               Allow cache for issues in minutes (default: 10)
  --utilizationPercentageThreshold <percent>       5-hour utilization hard threshold; tokens at or above this percentage are excluded from rotation (default: 90)
  --allowedIssueAuthors <authors>                  Comma-separated list of allowed issue authors
  --preparationProcessCheckCommand <template>      Shell command template with {URL} placeholder to check if a preparation process is alive

Options for notifyFinishedIssuePreparation:
  --configFilePath <path>                          Path to config file for tower defence management (required)
  --issueUrl <url>                                 GitHub issue URL (required)
  --projectUrl <url>                               GitHub project URL
  --thresholdForAutoReject <count>                 Threshold for auto-escalation after consecutive rejections (default: 3)
  --workflowBlockerResolvedWebhookUrl <url>        Webhook URL to notify when a workflow blocker issue status changes
```

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

## Config

### Schedule Command Config

The `config.yaml` for the `schedule` command must match the input type of `HandleScheduledEventUseCase.run()`. Below is the structure:

Workflow status names (`Unread`, `Awaiting Workspace`, `Preparation`, `Failed Preparation`, `Awaiting Quality Check`, `Todo by human`, `In Tmux by human`, `Done`, `Icebox`) are fixed code constants and cannot be overridden from CLI options, config files, or project README. The `schedule` command automatically creates any missing required statuses on the target project on each run via `SetupTowerDefenceProjectUseCase`. Projects with the legacy `Todo` and `In Tmux` status names are automatically migrated to `Todo by human` and `In Tmux by human` respectively by reusing the existing option IDs so that task associations are preserved. The legacy `PC Todo` status is removed from the required list and excluded from the project status list on the next setup run. The legacy `Awaiting Task Breakdown` status is removed from the required list; any project items in that status are automatically moved to `Todo by human` and the status option is removed on the next setup run.

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
  defaultLlmAgentName?: string | null # Optional: Default LLM agent name (overridable via llm-agent: label)
  maximumPreparingIssuesCount: number | null # Max concurrent preparing issues. When token rotation is active, effective concurrency is also capped at 6 per available token. When null, the default is 6 per available token, or 6 without token rotation
  utilizationPercentageThreshold?: number # Optional: 5-hour utilization hard threshold (percentage, default 90). Tokens at or above this value are excluded from rotation
  allowedIssueAuthors?: string[] | null # Optional: Only start preparation for issues from these authors (null = all authors)
  preparationProcessCheckCommand?: string # Optional: Shell command template with {URL} placeholder to check if a preparation process is alive. When set, orphaned Preparation issues (process exits non-zero, or stale aw log) are evaluated for completion: if work is done they advance to Awaiting Quality Check; otherwise they fall back to Awaiting Workspace
  awaitingQualityCheckStatus?: string | null # Optional: Project status name for issues awaiting quality check. When set with preparationProcessCheckCommand, orphaned issues with no rejections advance to this status instead of awaitingWorkspaceStatus
  codexHomeCandidates?: string[] | null # Optional: Ordered list of CODEX_HOME directory paths. Each launched Codex job cycles through the list; absent or empty keeps current behavior
  awLogDirectoryPath?: string # Optional: Directory path where aw log files named {org}_{repo}_{number}_* are written. Used with awLogStaleThresholdMinutes to detect zombie-wrapper orphans
  awLogStaleThresholdMinutes?: number # Optional: Minutes since last aw log mtime after which a Preparation issue is considered orphaned even when pgrep still returns 0 (outer wrapper alive but inner claude dead). Requires awLogDirectoryPath
claudeCodeOauthTokenListJsonPath?: string # Optional: Path to a JSON file listing long-term Claude Code OAuth tokens to rotate across (see "Claude OAuth Token Rotation" below). Declared at the top level (sibling of startPreparation), not inside it.
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
  awLogDirectoryPath: '/home/user/logs-aw'
  awLogStaleThresholdMinutes: 15
```

### startDaemon and notifyFinishedIssuePreparation Commands Config

The config YAML for `startDaemon` and `notifyFinishedIssuePreparation` commands:

```yaml
projectUrl: string # URL of the GitHub project
projectName: string # Project name (used for cache directory path)
defaultAgentName: string # Default agent name for issue preparation
defaultLlmModelName?: string # Optional: Default LLM model name
defaultLlmAgentName?: string # Optional: Default LLM agent name
maximumPreparingIssuesCount?: number # Optional: Max concurrent preparing issues. When token rotation is active, effective concurrency is also capped at 6 per available token. Omitted defaults to 6 per available token, or 6 without token rotation
allowIssueCacheMinutes?: number # Optional: Allow cache for issues in minutes (default: 10)
utilizationPercentageThreshold?: number # Optional: 5-hour utilization hard threshold (percentage, default 90). Tokens at or above this value are excluded from rotation
allowedIssueAuthors?: string # Optional: Comma-separated list of allowed issue authors
thresholdForAutoReject?: number # Optional: Consecutive rejections before escalation (default: 3)
workflowBlockerResolvedWebhookUrl?: string # Optional: Webhook URL. Supports {URL} and {MESSAGE} placeholders
preparationProcessCheckCommand?: string # Optional: Shell command template with {URL} placeholder to check if a preparation process is alive. Orphaned Preparation issues (process exits non-zero, or stale aw log) are evaluated for completion: if work is done they advance to Awaiting Quality Check; otherwise they fall back to Awaiting Workspace
codexHomeCandidates?: string[] # Optional: Ordered list of CODEX_HOME directory paths for Codex profile cycling. Absent or empty keeps current behavior
claudeCodeOauthTokenListJsonPath?: string # Optional: Path to a JSON file listing long-term Claude Code OAuth tokens to rotate across (see "Claude OAuth Token Rotation" below)
awLogDirectoryPath?: string # Optional: Directory path where aw log files named {org}_{repo}_{number}_* are written. Used with awLogStaleThresholdMinutes to detect zombie-wrapper orphans
awLogStaleThresholdMinutes?: number # Optional: Minutes since last aw log mtime after which a Preparation issue is considered orphaned even when pgrep still returns 0. Requires awLogDirectoryPath
```

Workflow status names (`Unread`, `Awaiting Workspace`, `Preparation`, `Failed Preparation`, `Awaiting Quality Check`, `Todo by human`, `In Tmux by human`, `Done`, `Icebox`) are hardcoded constants and are not accepted via this config, the CLI, or the project README. To ensure they exist on the target project, run the `schedule` command — it invokes `SetupTowerDefenceProjectUseCase` automatically. Projects with the legacy `Todo` and `In Tmux` status names are automatically migrated; `PC Todo` and `Awaiting Task Breakdown` are removed on the next setup run (items in `Awaiting Task Breakdown` are moved to `Todo by human` before the option is deleted).

Example:

```yaml
projectUrl: 'https://github.com/orgs/my-org/projects/1'
projectName: 'my-project'
defaultAgentName: 'aw'
defaultLlmModelName: 'claude-opus-4-5'
maximumPreparingIssuesCount: 3
utilizationPercentageThreshold: 90
thresholdForAutoReject: 3
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

For `startDaemon`, `schedule`, and `notifyFinishedIssuePreparation`, the GitHub project README can override config file values. Add a `<details><summary>config</summary>...</details>` section with YAML content to the project README. This takes highest priority over both the config file and CLI arguments. Any top-level YAML key inside the `config` section that does not match a recognized config field (for example, a misspelling such as `maximumPreparingIssueCount` instead of `maximumPreparingIssuesCount`) is ignored and a warning is logged with the unknown key name and the project URL, so config schema drift is not silently dropped.

### Claude OAuth Token Rotation

When `claudeCodeOauthTokenListJsonPath` is set, `startDaemon` distributes preparation jobs across multiple long-term Claude Code OAuth tokens to keep each token's 5-hour rate-limit window from saturating. The mechanism has three parts:

1. Token list file (referenced by `claudeCodeOauthTokenListJsonPath`): a JSON array of `{ name, token }` records, for example:

   ```json
   [
     { "name": "personal-1", "token": "sk-ant-..." },
     { "name": "personal-2", "token": "sk-ant-..." }
   ]
   ```

   The `name` field is optional; when absent, TDPM assigns a positional name (`token-1`, `token-2`, …) based on the entry's index in the array. Entries without a string `token` are skipped. Missing files or malformed JSON yield no tokens and disable rotation for that run (the daemon then falls back to whatever `CLAUDE_CODE_OAUTH_TOKEN` is already in the environment).

2. Local reverse proxy (`127.0.0.1:8787`): on each `startDaemon` run, the daemon TCP-probes the port. If nothing responds, it spawns a detached child running `bin/adapter/proxy/proxyEntry.js`. The proxy forwards every request to `api.anthropic.com`, observes the `anthropic-ratelimit-unified-*` response headers, and writes them to a per-token cache file at `${XDG_CACHE_HOME:-~/.cache}/tdpm/ratelimit/<sha256-of-token>.json`. The cache file stores the latest 5-hour and 7-day utilization, reset epochs, and the unified, 5-hour, and 7-day statuses (used to detect `blocked` and `rejected` state per window). In addition to the unified headers, the proxy inspects the streamed response body for `rate_limit` events (objects carrying `rateLimitType`, `status`, and `resetsAt`) and records the model-specific weekly limits — at minimum `seven_day_sonnet` and `seven_day` — per token. These model-specific weekly limits are exposed only in the response body, never in the unified headers, so a token can appear healthy on `anthropic-ratelimit-unified-7d-*` while its Sonnet weekly limit is exhausted.

3. Selection: before spawning each `aw` job, the daemon reads every token's cache file. A cached observation is treated as expired once its reset epoch has passed: when the current time is past the 5-hour reset, that token's 5-hour utilization is treated as `0` and any 5-hour-window rejection is cleared; likewise, when the 7-day reset has passed, the 7-day utilization is treated as `0` and any 7-day-window rejection is cleared; a model-specific weekly limit rejection is cleared once that limit's `resetsAt` has passed. This stale-reset expiry prevents a token that has actually recovered from being locked out of rotation forever (an excluded token receives no new requests, so the proxy never re-observes it). After expiry normalization, tokens whose status is `blocked`, whose remaining (non-expired) rejection is still active, whose 5-hour utilization meets or exceeds the configured threshold, or whose weekly limit for the model that will be used is rejected are excluded. The model name maps to a limit type: a model name containing `sonnet` maps to `seven_day_sonnet`, one containing `opus` maps to `seven_day_opus`, otherwise `seven_day`; the generic `seven_day` rejection also excludes regardless of model. The remaining eligible tokens are sorted by 7-day utilization ascending (lowest weekly load first). Each token's per-run concurrent preparation slot count is determined by its 7-day utilization: at or below 80%, the token receives the full six concurrent slots; above 80%, the slot count is reduced proportionally — specifically `ceil(6 × (1 − 7d_util) / 0.2)` — with a minimum of 1 slot at any utilization level, so near-exhausted tokens still participate rather than being cut off entirely. Tokens are dispatched round-robin across their available slots, with the token that has the lowest 7-day utilization selected preferentially. The effective preparation limit for a run is the lesser of the sum of all eligible tokens' slot counts and the explicit `maximumPreparingIssuesCount` (which defaults to 6). When a token list is configured but no eligible token remains after filtering, preparation is skipped for that run. The selected token and the proxy URL (`http://127.0.0.1:8787`) are passed to the child `aw` process as `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_BASE_URL` environment variables. The child inherits the parent process's environment, so no further wiring is required inside `aw`.

When `claudeCodeOauthTokenListJsonPath` is unset, no proxy is started and `aw` runs with whatever `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_BASE_URL` are already in the environment.

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

## Per-Project Situation Snapshot

After each schedule cycle, TDPM writes a per-project situation snapshot to:

```
./tmp/cache/{projectName}/situation-{projectId}.json
```

This file is written atomically (written to a `.tmp` file then renamed) so external readers never see a partial write.

### JSON Shape

```json
{
  "capturedAt": "2025-01-01T00:00:00.000Z",
  "config": {
    "maximumPreparingIssuesCount": 6,
    "utilizationPercentageThreshold": 90,
    "allowIssueCacheMinutes": 0,
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
- `config.allowIssueCacheMinutes`: Resolved issue cache duration in minutes.
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
- `rejected`: `true` if the token is marked as rejected by the API.
- `thresholdExcluded`: `true` if the token is eligible (not blocked or rejected) but excluded because its 5-hour utilization is at or above 95% (the fixed slot-zero boundary), giving it zero available preparation slots.

## Cadence and Cache Contract

The `schedule` command runs two distinct processing loops within a single invocation:

### Fast path (runs every cycle)

The following use cases execute on every `schedule` trigger (cadence is determined by the caller's cron/daemon, typically ~3 minutes):

- `RevertOrphanedPreparationUseCase` — reverts orphaned preparation issues back to awaiting-workspace
- `StartPreparationUseCase` — starts preparation for issues ready to be worked on
- `NotifyFinishedIssuePreparationUseCase` — checks preparation-status issues and advances them

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

The `allowIssueCacheMinutes` parameter (default: 10) controls how long the on-disk issue cache is considered fresh. With the default value of 10 minutes:

- The fast path reuses the slow path's cached issue list when it was populated within the last 10 minutes, avoiding redundant GitHub API calls.
- `ConvertCheckboxToIssueInStoryIssueUseCase` always fetches the latest story-issue body directly via `getIssueByUrl` regardless of the cache TTL, ensuring story bodies are never stale when converting checkboxes to issues.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
