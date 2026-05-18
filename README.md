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
  --maximumPreparingIssuesCount <count>            Maximum number of issues in preparation status (default: 6)
  --allowIssueCacheMinutes <minutes>               Allow cache for issues in minutes (default: 0)
  --utilizationPercentageThreshold <percent>       Claude utilization percentage threshold (default: 90)
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

Workflow status names (`Unread`, `Awaiting Task Breakdown`, `Awaiting Workspace`, `Preparation`, `Awaiting Quality Check`, `Todo`, `PC Todo`, `In Tmux`, `Done`, `Icebox`) are fixed code constants and cannot be overridden from CLI options, config files, or project README. The `schedule` command automatically creates any missing required statuses on the target project on each run via `SetupTowerDefenceProjectUseCase`.

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
  maximumPreparingIssuesCount: number | null # Max concurrent preparing issues (null = unlimited)
  utilizationPercentageThreshold?: number # Optional: Claude usage % threshold above which preparation is throttled (default: 90)
  allowedIssueAuthors?: string[] | null # Optional: Only start preparation for issues from these authors (null = all authors)
  preparationProcessCheckCommand?: string # Optional: Shell command template with {URL} placeholder to check if a preparation process is alive. When set, orphaned Preparation issues (process exits non-zero, or stale aw log) are evaluated for completion: if work is done they advance to Awaiting Quality Check; otherwise they fall back to Awaiting Workspace
  codexHomeCandidates?: string[] | null # Optional: Ordered list of CODEX_HOME directory paths. Each launched Codex job cycles through the list; absent or empty keeps current behavior
  awLogDirectoryPath?: string # Optional: Directory path where aw log files named {org}_{repo}_{number}_* are written. Used with awLogStaleThresholdMinutes to detect zombie-wrapper orphans
  awLogStaleThresholdMinutes?: number # Optional: Minutes since last aw log mtime after which a Preparation issue is considered orphaned even when pgrep still returns 0 (outer wrapper alive but inner claude dead). Requires awLogDirectoryPath
notifyFinishedPreparation?: # Optional: Enable notification when issue preparation is finished
  thresholdForAutoReject: number # Number of auto-rejections before escalating to quality check
  workflowBlockerResolvedWebhookUrl: string | null # Webhook URL template called when a workflow blocker issue passes checks. Supports {URL} and {MESSAGE} placeholders
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
  awLogDirectoryPath: '/home/user/logs-aw'
  awLogStaleThresholdMinutes: 15
notifyFinishedPreparation:
  thresholdForAutoReject: 3
  workflowBlockerResolvedWebhookUrl: 'https://example.com/webhook?url={URL}&msg={MESSAGE}'
```

### startDaemon and notifyFinishedIssuePreparation Commands Config

The config YAML for `startDaemon` and `notifyFinishedIssuePreparation` commands:

```yaml
projectUrl: string # URL of the GitHub project
projectName: string # Project name (used for cache directory path)
defaultAgentName: string # Default agent name for issue preparation
defaultLlmModelName?: string # Optional: Default LLM model name
defaultLlmAgentName?: string # Optional: Default LLM agent name
maximumPreparingIssuesCount?: number # Optional: Max concurrent preparing issues (omitted = 6)
allowIssueCacheMinutes?: number # Optional: Allow cache for issues in minutes (default: 0)
utilizationPercentageThreshold?: number # Optional: Claude usage % threshold (default: 90)
allowedIssueAuthors?: string # Optional: Comma-separated list of allowed issue authors
thresholdForAutoReject?: number # Optional: Consecutive rejections before escalation (default: 3)
workflowBlockerResolvedWebhookUrl?: string # Optional: Webhook URL. Supports {URL} and {MESSAGE} placeholders
preparationProcessCheckCommand?: string # Optional: Shell command template with {URL} placeholder to check if a preparation process is alive. Orphaned Preparation issues (process exits non-zero, or stale aw log) are evaluated for completion: if work is done they advance to Awaiting Quality Check; otherwise they fall back to Awaiting Workspace
codexHomeCandidates?: string[] # Optional: Ordered list of CODEX_HOME directory paths for Codex profile cycling. Absent or empty keeps current behavior
awLogDirectoryPath?: string # Optional: Directory path where aw log files named {org}_{repo}_{number}_* are written. Used with awLogStaleThresholdMinutes to detect zombie-wrapper orphans
awLogStaleThresholdMinutes?: number # Optional: Minutes since last aw log mtime after which a Preparation issue is considered orphaned even when pgrep still returns 0. Requires awLogDirectoryPath
```

Workflow status names (`Unread`, `Awaiting Task Breakdown`, `Awaiting Workspace`, `Preparation`, `Awaiting Quality Check`, `Todo`, `PC Todo`, `In Tmux`, `Done`, `Icebox`) are hardcoded constants and are not accepted via this config, the CLI, or the project README. To ensure they exist on the target project, run the `schedule` command — it invokes `SetupTowerDefenceProjectUseCase` automatically.

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

For `startDaemon`, `schedule`, and `notifyFinishedIssuePreparation`, the GitHub project README can override config file values. Add a `<details><summary>config</summary>...</details>` section with YAML content to the project README. This takes highest priority over both the config file and CLI arguments.

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
    "awaitingWorkspaceBlockedByDependency": 1
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
- `config.utilizationPercentageThreshold`: Resolved Claude utilization threshold percentage.
- `config.allowIssueCacheMinutes`: Resolved issue cache duration in minutes.
- `config.thresholdForAutoReject`: Resolved consecutive rejection count before auto-escalation.
- `status.awaitingQualityCheckImmediatelyActionable`: Count of issues in the awaiting quality check status with no dependency URL, next action date, or next action hour set.
- `status.preparation`: Count of issues currently in preparation status.
- `status.awaitingWorkspaceImmediatelyActionable`: Count of issues in awaiting workspace status with no dependency URL, next action date, or next action hour set.
- `status.awaitingWorkspaceBlockedByDependency`: Count of issues in awaiting workspace status that have a dependency URL set.
- `processes.runningPreparation`: Count of spawned preparation processes confirmed running via `preparationProcessCheckCommand`. `null` if `preparationProcessCheckCommand` is not configured.
- `system.memory.usedPercent`: Host memory usage as a percentage (MemTotal - MemAvailable / MemTotal × 100).
- `system.memory.usedGib` / `system.memory.totalGib`: Used and total host memory in GiB.
- `system.swap.usedPercent`: Host swap usage as a percentage.
- `system.swap.usedGib` / `system.swap.totalGib`: Used and total host swap in GiB.

System metrics are read from `/proc/meminfo` at snapshot write time.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
