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
  --awaitingWorkspaceStatus <status>               Status for issues awaiting workspace
  --preparationStatus <status>                     Status for issues in preparation
  --defaultAgentName <name>                        Default agent name
  --logFilePath <path>                             Path to log file
  --maximumPreparingIssuesCount <count>            Maximum number of issues in preparation status (default: 6)
  --allowIssueCacheMinutes <minutes>               Allow cache for issues in minutes (default: 0)

Options for notifyFinishedIssuePreparation:
  --configFilePath <path>                          Path to config file for tower defence management (required)
  --issueUrl <url>                                 GitHub issue URL (required)
  --projectUrl <url>                               GitHub project URL
  --preparationStatus <status>                     Status for issues in preparation
  --awaitingWorkspaceStatus <status>               Status for issues awaiting workspace
  --awaitingQualityCheckStatus <status>            Status for issues awaiting quality check
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

```yaml
disabled: boolean # When true, skip all processing and return null
org: string # Organization name
projectUrl: string # URL of the target project
manager: string # GitHub account name of the manager
defaultStatus?: string | null # Optional: Default status to assign to issues with null status and no status label
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
  awaitingWorkspaceStatus: string # Project status name for issues awaiting workspace
  preparationStatus: string # Project status name for issues in preparation
  defaultAgentName: string # Default agent name to assign for preparation
  logFilePath?: string # Optional: Path to log file for preparation output
  maximumPreparingIssuesCount: number | null # Max concurrent preparing issues (null = unlimited)
notifyFinishedPreparation?: # Optional: Enable notification when issue preparation is finished
  preparationStatus: string # Status name for issues in preparation
  awaitingWorkspaceStatus: string # Status name for issues awaiting workspace
  awaitingQualityCheckStatus: string # Status name for issues awaiting quality check
  thresholdForAutoReject: number # Number of auto-rejections before escalating to quality check
  workflowBlockerResolvedWebhookUrl: string | null # Webhook URL template called when a workflow blocker issue passes checks. Supports {URL} and {MESSAGE} placeholders
```

Example:

```yaml
disabled: false
org: 'my-org'
projectUrl: 'https://github.com/orgs/my-org/projects/1'
manager: 'HiromiShikata'
defaultStatus: 'Unread'
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
  awaitingWorkspaceStatus: 'Awaiting Workspace'
  preparationStatus: 'Preparation'
  defaultAgentName: 'umino-bot'
  logFilePath: '/tmp/preparation.log'
  maximumPreparingIssuesCount: 3
notifyFinishedPreparation:
  preparationStatus: 'Preparation'
  awaitingWorkspaceStatus: 'Awaiting Workspace'
  awaitingQualityCheckStatus: 'Awaiting Quality Check'
  thresholdForAutoReject: 3
  workflowBlockerResolvedWebhookUrl: 'https://example.com/webhook?url={URL}&msg={MESSAGE}'
```

### startDaemon and notifyFinishedIssuePreparation Commands Config

The config YAML for `startDaemon` and `notifyFinishedIssuePreparation` commands:

```yaml
projectUrl: string # URL of the GitHub project
projectName: string # Project name (used for cache directory path)
awaitingWorkspaceStatus: string # Status name for issues awaiting workspace
preparationStatus: string # Status name for issues in preparation
defaultAgentName: string # Default agent name for issue preparation
logFilePath?: string # Optional: Path to log file for preparation output
maximumPreparingIssuesCount?: number # Optional: Max concurrent preparing issues (null/omitted = 6)
allowIssueCacheMinutes?: number # Optional: Allow cache for issues in minutes (default: 0)
awaitingQualityCheckStatus: string # Status name for issues awaiting quality check
thresholdForAutoReject?: number # Optional: Consecutive rejections before escalation (default: 3)
workflowBlockerResolvedWebhookUrl?: string # Optional: Webhook URL. Supports {URL} and {MESSAGE} placeholders
```

Example:

```yaml
projectUrl: 'https://github.com/orgs/my-org/projects/1'
projectName: 'my-project'
awaitingWorkspaceStatus: 'Awaiting Workspace'
preparationStatus: 'Preparation'
defaultAgentName: 'umino-bot'
logFilePath: '/tmp/preparation.log'
maximumPreparingIssuesCount: 3
allowIssueCacheMinutes: 5
awaitingQualityCheckStatus: 'Awaiting Quality Check'
thresholdForAutoReject: 3
workflowBlockerResolvedWebhookUrl: 'https://example.com/webhook?url={URL}&msg={MESSAGE}'
```

#### README-based Config Overrides

For `startDaemon` and `notifyFinishedIssuePreparation`, the GitHub project README can override config file values. Add a `<details><summary>config</summary>...</details>` section with YAML content to the project README. This takes highest priority over both the config file and CLI arguments.

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

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
