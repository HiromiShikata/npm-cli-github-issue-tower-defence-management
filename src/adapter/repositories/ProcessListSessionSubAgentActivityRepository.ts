import { SubAgentActivity } from '../../domain/entities/LiveSessionActivitySnapshot';
import { SessionSubAgentActivityRepository } from '../../domain/usecases/adapter-interfaces/SessionSubAgentActivityRepository';
import { SubAgentProcessLister } from '../../domain/usecases/adapter-interfaces/SubAgentProcessLister';
import { SubAgentSilentSecondsResolver } from '../../domain/usecases/adapter-interfaces/SubAgentSilentSecondsResolver';

export class ProcessListSessionSubAgentActivityRepository
  implements SessionSubAgentActivityRepository
{
  private readonly matchRegExp: RegExp | null;

  constructor(
    matchPattern: string | null,
    private readonly processLister: SubAgentProcessLister,
    private readonly silentSecondsResolver: SubAgentSilentSecondsResolver,
  ) {
    this.matchRegExp =
      matchPattern === null || matchPattern.length === 0
        ? null
        : new RegExp(matchPattern);
  }

  listSubAgentActivitiesBySessionName = async (
    sessionNames: string[],
  ): Promise<Map<string, SubAgentActivity[]>> => {
    const result = new Map<string, SubAgentActivity[]>();
    if (this.matchRegExp === null) {
      return result;
    }
    const monitoredSessionNames = new Set(sessionNames);
    const processes = await this.processLister.listProcesses();
    for (const process of processes) {
      const match = this.matchRegExp.exec(process.commandLine);
      if (match === null || match.groups === undefined) {
        continue;
      }
      const sessionName = match.groups.session;
      if (sessionName === undefined || !monitoredSessionNames.has(sessionName)) {
        continue;
      }
      const label = match.groups.label ?? sessionName;
      const activity: SubAgentActivity = {
        label,
        silentSeconds: this.silentSecondsResolver.resolveSilentSeconds(label),
        runningSeconds: process.elapsedSeconds,
      };
      const existing = result.get(sessionName);
      if (existing === undefined) {
        result.set(sessionName, [activity]);
      } else {
        existing.push(activity);
      }
    }
    return result;
  };
}
