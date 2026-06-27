"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS = exports.notifySilentTmuxSessions = void 0;
const NotifySilentLiveSessionsUseCase_1 = require("../../../domain/usecases/NotifySilentLiveSessionsUseCase");
const DefaultSilentSessionMessageComposer_1 = require("../../../domain/usecases/DefaultSilentSessionMessageComposer");
const NodeTmuxSessionRepository_1 = require("../../repositories/NodeTmuxSessionRepository");
const FileSystemSessionOutputActivityRepository_1 = require("../../repositories/FileSystemSessionOutputActivityRepository");
const TmuxSilentSessionNotificationRepository_1 = require("../../repositories/TmuxSilentSessionNotificationRepository");
const NoUnansweredOwnerCallStatusProvider_1 = require("../../repositories/NoUnansweredOwnerCallStatusProvider");
const TranscriptOwnerCallStatusProvider_1 = require("../../repositories/TranscriptOwnerCallStatusProvider");
const ProcessListSessionSubAgentActivityRepository_1 = require("../../repositories/ProcessListSessionSubAgentActivityRepository");
const TranscriptSessionSubAgentActivityRepository_1 = require("../../repositories/TranscriptSessionSubAgentActivityRepository");
const FileSystemSubAgentTranscriptDirectoryResolver_1 = require("../../repositories/FileSystemSubAgentTranscriptDirectoryResolver");
const NodeSubAgentProcessLister_1 = require("../../repositories/NodeSubAgentProcessLister");
const FileSystemSubAgentSilentSecondsResolver_1 = require("../../repositories/FileSystemSubAgentSilentSecondsResolver");
const ConfigurableSilentSessionMessageComposer_1 = require("../../repositories/ConfigurableSilentSessionMessageComposer");
const RealSleeper_1 = require("../../repositories/RealSleeper");
const createOwnerCallStatusProvider = (sessionTranscriptRootDirectory, ownerCallMarker) => {
    if (sessionTranscriptRootDirectory !== null &&
        ownerCallMarker !== null &&
        ownerCallMarker.length > 0) {
        return new TranscriptOwnerCallStatusProvider_1.TranscriptOwnerCallStatusProvider(sessionTranscriptRootDirectory, ownerCallMarker);
    }
    return new NoUnansweredOwnerCallStatusProvider_1.NoUnansweredOwnerCallStatusProvider();
};
const createSubAgentActivityRepository = (subAgentTranscriptRootDirectory, subAgentProcessMatchPattern, subAgentOutputRootDirectory, localCommandRunner, now) => {
    if (subAgentTranscriptRootDirectory !== null) {
        return new TranscriptSessionSubAgentActivityRepository_1.TranscriptSessionSubAgentActivityRepository(new FileSystemSubAgentTranscriptDirectoryResolver_1.FileSystemSubAgentTranscriptDirectoryResolver(subAgentTranscriptRootDirectory), now);
    }
    return new ProcessListSessionSubAgentActivityRepository_1.ProcessListSessionSubAgentActivityRepository(subAgentProcessMatchPattern, new NodeSubAgentProcessLister_1.NodeSubAgentProcessLister(localCommandRunner), new FileSystemSubAgentSilentSecondsResolver_1.FileSystemSubAgentSilentSecondsResolver(subAgentOutputRootDirectory, now));
};
const notifySilentTmuxSessions = async (params) => {
    const { project, allowCacheMinutes, issueRepository, localCommandRunner, cacheRepository, sessionOutputRootDirectory, sessionTranscriptRootDirectory, ownerCallMarker, subAgentOutputRootDirectory, subAgentProcessMatchPattern, subAgentTranscriptRootDirectory, mainSilentThresholdSeconds, subAgentSilentThresholdSeconds, subAgentRunningThresholdSeconds, cooldownSeconds, staggerSeconds, messageTemplates, now, } = params;
    if (sessionOutputRootDirectory === null &&
        subAgentProcessMatchPattern === null &&
        subAgentTranscriptRootDirectory === null) {
        console.log('Silent live session notification skipped: no session output root directory, sub-agent process match pattern, or sub-agent transcript root directory is configured.');
        return;
    }
    const messageComposer = new ConfigurableSilentSessionMessageComposer_1.ConfigurableSilentSessionMessageComposer(messageTemplates, new DefaultSilentSessionMessageComposer_1.DefaultSilentSessionMessageComposer());
    const useCase = new NotifySilentLiveSessionsUseCase_1.NotifySilentLiveSessionsUseCase(issueRepository, new NodeTmuxSessionRepository_1.NodeTmuxSessionRepository(localCommandRunner), new FileSystemSessionOutputActivityRepository_1.FileSystemSessionOutputActivityRepository(sessionOutputRootDirectory), createSubAgentActivityRepository(subAgentTranscriptRootDirectory, subAgentProcessMatchPattern, subAgentOutputRootDirectory, localCommandRunner, now), createOwnerCallStatusProvider(sessionTranscriptRootDirectory, ownerCallMarker), new TmuxSilentSessionNotificationRepository_1.TmuxSilentSessionNotificationRepository(localCommandRunner, cacheRepository), messageComposer, new RealSleeper_1.RealSleeper());
    await useCase.run({
        project,
        allowCacheMinutes,
        monitoredStatus: NotifySilentLiveSessionsUseCase_1.DEFAULT_MONITORED_STATUS,
        mainSilentThresholdSeconds,
        subAgentSilentThresholdSeconds,
        subAgentRunningThresholdSeconds,
        cooldownSeconds,
        staggerSeconds,
        now,
    });
};
exports.notifySilentTmuxSessions = notifySilentTmuxSessions;
exports.DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS = {
    mainSilentThresholdSeconds: NotifySilentLiveSessionsUseCase_1.DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
    subAgentSilentThresholdSeconds: NotifySilentLiveSessionsUseCase_1.DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
    subAgentRunningThresholdSeconds: NotifySilentLiveSessionsUseCase_1.DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
    cooldownSeconds: NotifySilentLiveSessionsUseCase_1.DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
    staggerSeconds: NotifySilentLiveSessionsUseCase_1.DEFAULT_NOTIFICATION_STAGGER_SECONDS,
};
//# sourceMappingURL=notifySilentTmuxSessions.js.map