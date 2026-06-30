"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS = exports.notifySilentTmuxSessions = void 0;
const NotifySilentLiveSessionsUseCase_1 = require("../../../domain/usecases/NotifySilentLiveSessionsUseCase");
const DefaultSilentSessionMessageComposer_1 = require("../../../domain/usecases/DefaultSilentSessionMessageComposer");
const LocalProcessLiveSessionProcessSnapshotProvider_1 = require("../../repositories/LocalProcessLiveSessionProcessSnapshotProvider");
const ProcFsProcessEnvironReader_1 = require("../../repositories/ProcFsProcessEnvironReader");
const FileSystemInteractiveLiveSessionTranscriptResolver_1 = require("../../repositories/FileSystemInteractiveLiveSessionTranscriptResolver");
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
const FileSystemSilentSessionCandidateStateRepository_1 = require("../../repositories/FileSystemSilentSessionCandidateStateRepository");
const FileSystemSilentSessionHubTaskStatusCacheRepository_1 = require("../../repositories/FileSystemSilentSessionHubTaskStatusCacheRepository");
const createOwnerCallStatusProvider = (ownerCallMarker) => {
    if (ownerCallMarker !== null && ownerCallMarker.length > 0) {
        return new TranscriptOwnerCallStatusProvider_1.TranscriptOwnerCallStatusProvider(ownerCallMarker);
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
    const { enabled, localCommandRunner, processEnvironReader, ownerCallMarker, subAgentOutputRootDirectory, subAgentProcessMatchPattern, subAgentTranscriptRootDirectory, mainSilentThresholdSeconds, subAgentSilentThresholdSeconds, subAgentRunningThresholdSeconds, staggerSeconds, candidateDebounceRecencyWindowSeconds, candidateDebounceStateFilePath, activeHubTaskStatus, hubTaskStatusResolver, hubTaskStatusCacheStateFilePath, hubTaskStatusCacheTtlSeconds, messageTemplates, now, } = params;
    if (!enabled) {
        console.log('Silent live session notification skipped: not enabled (set silentNotificationEnabled or TDPM_SILENT_NOTIFICATION_ENABLED=true to enable).');
        return;
    }
    const messageComposer = new ConfigurableSilentSessionMessageComposer_1.ConfigurableSilentSessionMessageComposer(messageTemplates, new DefaultSilentSessionMessageComposer_1.DefaultSilentSessionMessageComposer(ownerCallMarker));
    const useCase = new NotifySilentLiveSessionsUseCase_1.NotifySilentLiveSessionsUseCase(new LocalProcessLiveSessionProcessSnapshotProvider_1.LocalProcessLiveSessionProcessSnapshotProvider(localCommandRunner, processEnvironReader ?? new ProcFsProcessEnvironReader_1.ProcFsProcessEnvironReader()), new FileSystemInteractiveLiveSessionTranscriptResolver_1.FileSystemInteractiveLiveSessionTranscriptResolver(), new FileSystemSessionOutputActivityRepository_1.FileSystemSessionOutputActivityRepository(), createSubAgentActivityRepository(subAgentTranscriptRootDirectory, subAgentProcessMatchPattern, subAgentOutputRootDirectory, localCommandRunner, now), createOwnerCallStatusProvider(ownerCallMarker), new TmuxSilentSessionNotificationRepository_1.TmuxSilentSessionNotificationRepository(localCommandRunner), candidateDebounceStateFilePath !== null
        ? new FileSystemSilentSessionCandidateStateRepository_1.FileSystemSilentSessionCandidateStateRepository(candidateDebounceStateFilePath)
        : new FileSystemSilentSessionCandidateStateRepository_1.FileSystemSilentSessionCandidateStateRepository(), messageComposer, new RealSleeper_1.RealSleeper(), hubTaskStatusResolver, hubTaskStatusCacheStateFilePath !== null
        ? new FileSystemSilentSessionHubTaskStatusCacheRepository_1.FileSystemSilentSessionHubTaskStatusCacheRepository(hubTaskStatusCacheStateFilePath)
        : new FileSystemSilentSessionHubTaskStatusCacheRepository_1.FileSystemSilentSessionHubTaskStatusCacheRepository());
    await useCase.run({
        mainSilentThresholdSeconds,
        subAgentSilentThresholdSeconds,
        subAgentRunningThresholdSeconds,
        staggerSeconds,
        candidateDebounceRecencyWindowSeconds,
        activeHubTaskStatus,
        hubTaskStatusCacheTtlSeconds,
        now,
    });
};
exports.notifySilentTmuxSessions = notifySilentTmuxSessions;
exports.DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS = {
    mainSilentThresholdSeconds: NotifySilentLiveSessionsUseCase_1.DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
    subAgentSilentThresholdSeconds: NotifySilentLiveSessionsUseCase_1.DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
    subAgentRunningThresholdSeconds: NotifySilentLiveSessionsUseCase_1.DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
    staggerSeconds: NotifySilentLiveSessionsUseCase_1.DEFAULT_NOTIFICATION_STAGGER_SECONDS,
    candidateDebounceRecencyWindowSeconds: NotifySilentLiveSessionsUseCase_1.DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS,
    hubTaskStatusCacheTtlSeconds: NotifySilentLiveSessionsUseCase_1.DEFAULT_HUB_TASK_STATUS_CACHE_TTL_SECONDS,
};
//# sourceMappingURL=notifySilentTmuxSessions.js.map