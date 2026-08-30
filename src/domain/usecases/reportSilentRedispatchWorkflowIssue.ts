import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';

export type WorkflowIssueReporterSettings = {
  owner: string;
  repo: string;
  projectUrl?: string | null;
};

export const reportSilentRedispatchWorkflowIssue = async (
  agentName: string,
  failingTaskUrl: string,
  settings: WorkflowIssueReporterSettings,
  issueRepository: Pick<
    IssueRepository,
    | 'searchIssue'
    | 'createNewIssue'
    | 'createCommentByUrl'
    | 'addIssueToProject'
    | 'getIssueByUrl'
    | 'updateStory'
  >,
  projectRepository: Pick<ProjectRepository, 'getByUrl'>,
): Promise<void> => {
  const title = `TDPM agent not reporting: ${agentName}`;
  try {
    const existingIssues = await issueRepository.searchIssue({
      owner: settings.owner,
      repositoryName: settings.repo,
      type: 'issue',
      state: 'open',
      title,
    });
    const existing = existingIssues.find((i) => i.title === title);
    if (existing) {
      await issueRepository.createCommentByUrl(
        existing.url,
        `The TDPM preparation loop received no report from \`${agentName}\` again.\n\nFailing task: ${failingTaskUrl}`,
      );
    } else {
      const body = [
        `The TDPM preparation loop dispatched \`${agentName}\` and received no report, which indicates a TDPM process-level problem rather than a task-specific one.`,
        '',
        `- Agent: \`${agentName}\``,
        `- Failing task: ${failingTaskUrl}`,
      ].join('\n');
      const issueNumber = await issueRepository.createNewIssue(
        settings.owner,
        settings.repo,
        title,
        body,
        [],
        [],
      );
      const newIssueUrl = `https://github.com/${settings.owner}/${settings.repo}/issues/${issueNumber}`;
      console.log(
        `Created workflow issue #${issueNumber} for silent redispatch of ${agentName}: ${newIssueUrl}`,
      );
      if (settings.projectUrl) {
        try {
          const reporterProject = await projectRepository.getByUrl(
            settings.projectUrl,
          );
          await issueRepository.addIssueToProject(reporterProject, newIssueUrl);
          if (reporterProject.story) {
            const workflowBlockerStory = reporterProject.story.stories.find(
              (s) => s.name.toLowerCase().includes('workflow blocker'),
            );
            if (workflowBlockerStory) {
              const newIssue = await issueRepository.getIssueByUrl(newIssueUrl);
              if (newIssue) {
                await issueRepository.updateStory(
                  { ...reporterProject, story: reporterProject.story },
                  newIssue,
                  workflowBlockerStory.id,
                );
              }
            }
          }
        } catch (projectError) {
          console.warn(
            `Failed to add workflow issue ${newIssueUrl} to project ${settings.projectUrl}:`,
            projectError,
          );
        }
      }
    }
  } catch (error) {
    console.warn(
      `Failed to report silent redispatch workflow issue for ${agentName}:`,
      error,
    );
  }
};
