import {
  ClosedItem,
  MergedPullRequest,
  ProjectDoraConfig,
  ProjectDoraMetrics,
  WorkflowRun,
} from '../entities/DoraMetrics';
import { GithubActionsRepository } from './adapter-interfaces/GithubActionsRepository';

type CreateNewIssue = (
  owner: string,
  repo: string,
  title: string,
  body: string,
  assignees: string[],
  labels: string[],
) => Promise<number>;

export class DoraMetricsWeeklyMeasureUseCase {
  constructor(
    private readonly githubActionsRepository: GithubActionsRepository,
    private readonly createNewIssue: CreateNewIssue,
  ) {}

  run = async (params: {
    projects: ProjectDoraConfig[];
    reportOwner: string;
    reportRepo: string;
    since: Date;
    until: Date;
  }): Promise<void> => {
    const metrics: ProjectDoraMetrics[] = [];

    for (const project of params.projects) {
      const projectMetrics = await this.measureProject(
        project,
        params.since,
        params.until,
      );
      metrics.push(projectMetrics);
    }

    const reportTitle = `DORAメトリクス週次レポート ${this.formatDate(params.until)}`;
    const reportBody = this.buildReportBody(
      metrics,
      params.since,
      params.until,
    );

    await this.createNewIssue(
      params.reportOwner,
      params.reportRepo,
      reportTitle,
      reportBody,
      [],
      [],
    );
  };

  private measureProject = async (
    config: ProjectDoraConfig,
    since: Date,
    until: Date,
  ): Promise<ProjectDoraMetrics> => {
    const allRuns: WorkflowRun[] = [];
    for (const workflowFile of config.deployWorkflowFiles) {
      const runs = await this.githubActionsRepository.getWorkflowRuns(
        config.owner,
        config.repo,
        workflowFile,
        config.deployBranch,
        since,
        until,
      );
      allRuns.push(...runs);
    }

    const deployFrequency = allRuns.length;
    const changeFailureRate =
      deployFrequency > 0
        ? allRuns.filter((r) => r.conclusion === 'failure').length /
          deployFrequency
        : null;

    const mergedPRs = await this.githubActionsRepository.getMergedPullRequests(
      config.owner,
      config.repo,
      config.prBaseBranch,
      since,
      until,
    );

    const changeLeadTimeHours = this.calculateChangeLeadTime(
      mergedPRs,
      allRuns,
    );

    const hotfixItems =
      await this.githubActionsRepository.getClosedItemsByLabels(
        config.owner,
        config.repo,
        config.mttrLabels,
        since,
        until,
      );

    const mttrHours = this.calculateMttr(hotfixItems);

    return {
      projectName: config.name,
      deployFrequency,
      changeFailureRate,
      changeLeadTimeHours,
      mttrHours,
    };
  };

  private calculateChangeLeadTime = (
    prs: MergedPullRequest[],
    runs: WorkflowRun[],
  ): number | null => {
    if (prs.length === 0) return null;

    if (runs.length > 0) {
      const sortedRuns = [...runs].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      const matched = prs.flatMap((pr) => {
        const nextRun = sortedRuns.find((r) => r.createdAt >= pr.mergedAt);
        if (!nextRun) return [];
        return [
          (nextRun.updatedAt.getTime() - pr.mergedAt.getTime()) / 3600000,
        ];
      });
      return matched.length > 0
        ? matched.reduce((a, b) => a + b, 0) / matched.length
        : null;
    }

    const totalHours = prs.reduce(
      (sum, pr) =>
        sum + (pr.mergedAt.getTime() - pr.createdAt.getTime()) / 3600000,
      0,
    );
    return totalHours / prs.length;
  };

  private calculateMttr = (items: ClosedItem[]): number | null => {
    if (items.length === 0) return null;
    const totalHours = items.reduce(
      (sum, item) =>
        sum + (item.closedAt.getTime() - item.createdAt.getTime()) / 3600000,
      0,
    );
    return totalHours / items.length;
  };

  private formatDate = (date: Date): string => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  private buildReportBody = (
    metrics: ProjectDoraMetrics[],
    since: Date,
    until: Date,
  ): string => {
    const sinceStr = this.formatDate(since);
    const untilStr = this.formatDate(until);

    const rows = metrics.map((m) => {
      const failRate =
        m.changeFailureRate !== null
          ? `${(m.changeFailureRate * 100).toFixed(1)}%`
          : 'N/A';
      const leadTime =
        m.changeLeadTimeHours !== null
          ? m.changeLeadTimeHours.toFixed(1)
          : 'N/A';
      const mttr = m.mttrHours !== null ? m.mttrHours.toFixed(1) : 'N/A';
      return `| ${m.projectName} | ${m.deployFrequency} | ${failRate} | ${leadTime} | ${mttr} |`;
    });

    return [
      `## DORAメトリクス週次レポート（${untilStr}週）`,
      '',
      `計測期間: ${sinceStr} 〜 ${untilStr}`,
      '',
      '| プロジェクト | デプロイ頻度（回/週） | 変更失敗率 | 変更リードタイム（時間） | MTTR（時間） |',
      '|---|---|---|---|---|',
      ...rows,
      '',
      '---',
      '',
      '詳細はワークフローログを参照。',
    ].join('\n');
  };
}
