import { LiveSessionProcessSnapshotProvider } from './adapter-interfaces/LiveSessionProcessSnapshotProvider';
import { InteractiveLiveSessionTranscriptResolver } from './adapter-interfaces/InteractiveLiveSessionTranscriptResolver';
import { SessionAssistantTurnsRepository } from './adapter-interfaces/SessionAssistantTurnsRepository';
import { SessionDegenerationCooldownStateRepository } from './adapter-interfaces/SessionDegenerationCooldownStateRepository';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { Sleeper } from './adapter-interfaces/Sleeper';
import {
  OutputDegenerationDetector,
  OUTPUT_DEGENERATION_CROSS_TURN_WINDOW,
} from './OutputDegenerationDetector';
import { ResolveInteractiveLiveSessionsUseCase } from './ResolveInteractiveLiveSessionsUseCase';
import { isGitHubIssueOrPullRequestSessionName } from './NotifySilentLiveSessionsUseCase';

export const DEFAULT_OUTPUT_DEGENERATION_GRACE_SECONDS = 5;
export const DEFAULT_OUTPUT_DEGENERATION_COOLDOWN_SECONDS = 300;
export const DEFAULT_OUTPUT_DEGENERATION_WARNING_MESSAGE =
  'OUTPUT DEGENERATION DETECTED: your session is about to be reset. Immediately write a checkpoint to your assigned task issue (single concrete next action to resume, working directory and branch, in-flight sub-agent branch/PR URLs).';

export class SessionOutputDegenerationRecoveryUseCase {
  private readonly resolveInteractiveLiveSessions =
    new ResolveInteractiveLiveSessionsUseCase();

  constructor(
    private readonly liveSessionProcessSnapshotProvider: LiveSessionProcessSnapshotProvider,
    private readonly interactiveLiveSessionTranscriptResolver: InteractiveLiveSessionTranscriptResolver,
    private readonly assistantTurnsRepository: SessionAssistantTurnsRepository,
    private readonly notificationRepository: SilentSessionNotificationRepository,
    private readonly tmuxSessionRepository: Pick<
      TmuxSessionRepository,
      'killSession'
    >,
    private readonly cooldownStateRepository: SessionDegenerationCooldownStateRepository,
    private readonly sleeper: Sleeper,
    private readonly detector: OutputDegenerationDetector = new OutputDegenerationDetector(),
  ) {}

  run = async (params: {
    enabled: boolean;
    warningMessage: string;
    graceSeconds: number;
    cooldownSeconds: number;
    now: Date;
  }): Promise<void> => {
    const snapshot =
      await this.liveSessionProcessSnapshotProvider.getSnapshot();
    const allInteractiveSessions =
      this.resolveInteractiveLiveSessions.resolve(snapshot);
    const interactiveSessions = allInteractiveSessions.filter((session) =>
      isGitHubIssueOrPullRequestSessionName(session.sessionName),
    );

    const transcriptPathBySessionName =
      this.interactiveLiveSessionTranscriptResolver.resolveTranscriptPaths(
        interactiveSessions,
      );
    const turnsBySessionName =
      await this.assistantTurnsRepository.listRecentAssistantTurnsBySessionName(
        transcriptPathBySessionName,
        OUTPUT_DEGENERATION_CROSS_TURN_WINDOW,
      );
    const lastResetBySessionName =
      await this.cooldownStateRepository.loadLastResetEpochSecondsBySessionName();

    const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
    let detectedCount = 0;
    let resetCount = 0;
    let dryRunCount = 0;
    let cooldownSkippedCount = 0;

    for (const session of interactiveSessions) {
      const sessionName = session.sessionName;
      const lastResetEpochSeconds = lastResetBySessionName.get(sessionName);
      if (
        lastResetEpochSeconds !== undefined &&
        nowEpochSeconds - lastResetEpochSeconds < params.cooldownSeconds
      ) {
        cooldownSkippedCount += 1;
        continue;
      }

      const turns = turnsBySessionName.get(sessionName) ?? [];
      const newestTurn = turns.length > 0 ? turns[0] : null;
      const intraTurn =
        newestTurn !== null &&
        this.detector.isIntraTurnDegeneration(newestTurn);
      const crossTurn = this.detector.detectCrossTurnDegeneration(turns);
      if (!intraTurn && crossTurn === null) {
        continue;
      }
      detectedCount += 1;

      if (intraTurn && newestTurn !== null) {
        const { token, run, total } =
          this.detector.maxConsecutiveShortTokenRun(newestTurn);
        console.log(
          `Output degeneration detected (intra-turn) session=${sessionName} token=${JSON.stringify(token)} run=${run} turnTokens=${total} enabled=${params.enabled}`,
        );
      }
      if (crossTurn !== null) {
        console.log(
          `Output degeneration detected (cross-turn) session=${sessionName} token=${JSON.stringify(crossTurn.token)} turns=${crossTurn.turnCount}/${Math.min(turns.length, OUTPUT_DEGENERATION_CROSS_TURN_WINDOW)} enabled=${params.enabled}`,
        );
      }

      if (params.enabled) {
        try {
          await this.notificationRepository.sendSelfCheckNotification(
            sessionName,
            params.warningMessage,
          );
          await this.sleeper.sleep(params.graceSeconds * 1000);
          await this.tmuxSessionRepository.killSession(sessionName);
          resetCount += 1;
          console.log(
            `Output degeneration reset session=${sessionName} graceSeconds=${params.graceSeconds}`,
          );
        } catch (error) {
          console.error(
            `Failed to reset degenerated session ${sessionName}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          continue;
        }
      } else {
        dryRunCount += 1;
        console.log(
          `Output degeneration dry-run: would warn and reset session=${sessionName}`,
        );
      }
      await this.cooldownStateRepository.recordReset({
        sessionName,
        now: params.now,
      });
    }

    console.log(
      `Output degeneration recovery: detected ${detectedCount} degenerated session(s) of ${interactiveSessions.length} interactive session(s); reset ${resetCount}, dry-run would-reset ${dryRunCount}, cooldown-skipped ${cooldownSkippedCount}.`,
    );
  };
}
