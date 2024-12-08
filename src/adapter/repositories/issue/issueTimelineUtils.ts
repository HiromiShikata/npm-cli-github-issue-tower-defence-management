import { WorkingTime } from '../../../domain/entities/WorkingTime';

export type IssueStatusTimeline = {
  time: string;
  author: string;
  from: string;
  to: string;
};
export type IssueInProgressTimeline = WorkingTime & {
  issueUrl: string;
};

export const getInProgressTimeline = async (
  timelines: IssueStatusTimeline[],
  issueUrl: string,
): Promise<WorkingTime[]> => {
  const report: IssueInProgressTimeline[] = [];
  let currentInProgress:
    | Pick<IssueInProgressTimeline, 'issueUrl' | 'author' | 'startedAt'>
    | undefined = undefined;
  for (const timeline of timelines) {
    const time = new Date(timeline.time);
    if (timeline.to.toLocaleLowerCase().includes('in progress')) {
      if (currentInProgress !== undefined) {
        report.push({
          ...currentInProgress,
          endedAt: time,
          durationMinutes:
            Math.floor(time.getTime() / 1000 / 60) -
            Math.floor(currentInProgress.startedAt.getTime() / 1000 / 60),
        });
        currentInProgress = undefined;
      }
      currentInProgress = {
        issueUrl: issueUrl,
        author: timeline.author,
        startedAt: time,
      };
      continue;
    }
    if (currentInProgress != undefined) {
      report.push({
        ...currentInProgress,
        endedAt: time,
        durationMinutes:
          (time.getTime() - currentInProgress.startedAt.getTime()) / 1000 / 60,
      });
      currentInProgress = undefined;
    }
  }
  return report;
};
