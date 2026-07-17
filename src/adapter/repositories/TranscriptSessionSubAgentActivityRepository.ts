import * as fs from 'fs';
import * as path from 'path';
import { SubAgentActivity } from '../../domain/entities/LiveSessionActivitySnapshot';
import { SessionSubAgentActivityRepository } from '../../domain/usecases/adapter-interfaces/SessionSubAgentActivityRepository';
import { SubAgentProcessLister } from '../../domain/usecases/adapter-interfaces/SubAgentProcessLister';
import { SubAgentTranscriptDirectoryResolver } from '../../domain/usecases/adapter-interfaces/SubAgentTranscriptDirectoryResolver';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (
  value: Record<string, unknown>,
  key: string,
): string | null => {
  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : null;
};

const parseEpochSeconds = (timestamp: string | null): number | null => {
  if (timestamp === null) {
    return null;
  }
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
};

const PENDING_TOOL_COMMAND_FRAGMENT_LENGTH = 60;

export const normalizeCommandFragment = (command: string): string =>
  command
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PENDING_TOOL_COMMAND_FRAGMENT_LENGTH);

type ParsedTranscript = {
  firstEntryEpochSeconds: number | null;
  lastEntryIndicatesCompletion: boolean;
  pendingToolCommands: string[];
  pendingDelegationToolUse: boolean;
};

const readContentBlocks = (
  message: Record<string, unknown>,
): Record<string, unknown>[] => {
  const content = message.content;
  if (!Array.isArray(content)) {
    return [];
  }
  return content.filter(isRecord);
};

// Tool whose result marks the sub-agent's final structured answer: once its
// tool_result is recorded, the sub-agent has delivered its output and is
// genuinely complete even though the transcript tail is a user entry.
const COMPLETION_TOOL_NAMES = new Set(['StructuredOutput']);

// Tools that delegate work to a nested child sub-agent. A parent whose
// transcript tail is a pending tool_use of one of these tools is waiting for
// the child to run (possibly queued), produces no transcript writes of its
// own, and therefore looks "silent" by mtime alone. Such a parent is treated
// as waiting on an external process so it is excluded from both the
// sub-agent-idle and sub-agent-long-running selections.
const DELEGATION_TOOL_NAMES = new Set(['Agent', 'Task']);

const entryToolUseNames = (message: Record<string, unknown>): string[] =>
  readContentBlocks(message)
    .filter((block) => readString(block, 'type') === 'tool_use')
    .map((block) => readString(block, 'name'))
    .filter((name): name is string => name !== null);

const entryIndicatesCompletion = (
  entry: Record<string, unknown>,
  precedingAssistantToolUseNames: string[],
): boolean => {
  const type = readString(entry, 'type');
  const message = entry.message;
  if (!isRecord(message)) {
    return false;
  }
  if (type === 'assistant') {
    const stopReason = readString(message, 'stop_reason');
    if (stopReason === 'end_turn' || stopReason === 'stop_sequence') {
      return true;
    }
    const blocks = readContentBlocks(message);
    const lastBlock = blocks[blocks.length - 1];
    return lastBlock !== undefined && readString(lastBlock, 'type') === 'text';
  }
  if (type === 'user') {
    const blocks = readContentBlocks(message);
    if (blocks.length === 0) {
      return true;
    }
    const lastBlock = blocks[blocks.length - 1];
    const lastBlockType = readString(lastBlock, 'type');
    if (lastBlockType === 'text') {
      // A trailing user text entry is an interruption (e.g. "[Request
      // interrupted by user]"): the sub-agent will not produce further
      // output, so the transcript is terminal.
      return true;
    }
    if (lastBlockType === 'tool_result') {
      // A trailing tool_result is an IN-FLIGHT state, not completion: the
      // sub-agent has just received a tool result and the next assistant
      // turn is being generated. Treating it as completion made an active
      // agent flap in and out of the activity snapshot between samples
      // (tail alternates between pending tool_use and tool_result). Only
      // the result of an explicit completion tool (see
      // COMPLETION_TOOL_NAMES) is a genuine terminal state, so completed
      // agents still drop out of the snapshot.
      return precedingAssistantToolUseNames.some((name) =>
        COMPLETION_TOOL_NAMES.has(name),
      );
    }
    return false;
  }
  return false;
};

const entryPendingToolCommands = (entry: Record<string, unknown>): string[] => {
  const type = readString(entry, 'type');
  const message = entry.message;
  if (type !== 'assistant' || !isRecord(message)) {
    return [];
  }
  const commands: string[] = [];
  for (const block of readContentBlocks(message)) {
    if (readString(block, 'type') !== 'tool_use') {
      continue;
    }
    const input = block.input;
    if (!isRecord(input)) {
      continue;
    }
    const command = readString(input, 'command');
    if (command !== null && command.trim().length > 0) {
      commands.push(command);
    }
  }
  return commands;
};

const parseTranscript = (content: string): ParsedTranscript => {
  let firstEntryEpochSeconds: number | null = null;
  let lastEntryIndicatesCompletion = false;
  let pendingToolCommands: string[] = [];
  let pendingDelegationToolUse = false;
  let precedingAssistantToolUseNames: string[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!isRecord(parsed)) {
      continue;
    }
    const epochSeconds = parseEpochSeconds(readString(parsed, 'timestamp'));
    if (firstEntryEpochSeconds === null && epochSeconds !== null) {
      firstEntryEpochSeconds = epochSeconds;
    }
    if (isRecord(parsed.message)) {
      lastEntryIndicatesCompletion = entryIndicatesCompletion(
        parsed,
        precedingAssistantToolUseNames,
      );
      pendingToolCommands = entryPendingToolCommands(parsed);
      if (readString(parsed, 'type') === 'assistant') {
        precedingAssistantToolUseNames = entryToolUseNames(parsed.message);
        pendingDelegationToolUse = precedingAssistantToolUseNames.some((name) =>
          DELEGATION_TOOL_NAMES.has(name),
        );
      } else {
        pendingDelegationToolUse = false;
      }
    }
  }
  return {
    firstEntryEpochSeconds,
    lastEntryIndicatesCompletion,
    pendingToolCommands,
    pendingDelegationToolUse,
  };
};

const clampToZero = (value: number): number => (value > 0 ? value : 0);

export class TranscriptSessionSubAgentActivityRepository implements SessionSubAgentActivityRepository {
  constructor(
    private readonly directoryResolver: SubAgentTranscriptDirectoryResolver,
    private readonly processLister: SubAgentProcessLister,
    private readonly now: Date,
  ) {}

  listSubAgentActivitiesBySessionName = async (
    sessionNames: string[],
    transcriptPathBySessionName: Map<string, string>,
  ): Promise<Map<string, SubAgentActivity[]>> => {
    const result = new Map<string, SubAgentActivity[]>();
    const nowEpochSeconds = Math.floor(this.now.getTime() / 1000);
    let normalizedProcessCommandLines: string[] | null = null;
    const loadNormalizedProcessCommandLines = async (): Promise<string[]> => {
      if (normalizedProcessCommandLines === null) {
        const processes = await this.processLister.listProcesses();
        normalizedProcessCommandLines = processes.map((process) =>
          process.commandLine.replace(/\s+/g, ' ').trim(),
        );
      }
      return normalizedProcessCommandLines;
    };
    for (const sessionName of sessionNames) {
      const mainTranscriptPath =
        transcriptPathBySessionName.get(sessionName) ?? null;
      const directory = this.directoryResolver.resolveSubAgentsDirectory(
        sessionName,
        mainTranscriptPath,
      );
      if (directory === null) {
        continue;
      }
      const activities = await this.collectActivities(
        directory,
        nowEpochSeconds,
        loadNormalizedProcessCommandLines,
      );
      if (activities.length > 0) {
        result.set(sessionName, activities);
      }
    }
    return result;
  };

  private collectActivities = async (
    directory: string,
    nowEpochSeconds: number,
    loadNormalizedProcessCommandLines: () => Promise<string[]>,
  ): Promise<SubAgentActivity[]> => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return [];
    }
    const activities: SubAgentActivity[] = [];
    for (const entry of entries) {
      const fileName = entry.name;
      if (!fileName.startsWith('agent-') || !fileName.endsWith('.jsonl')) {
        continue;
      }
      const filePath = path.join(directory, fileName);
      const activity = await this.toActivity(
        filePath,
        fileName,
        nowEpochSeconds,
        loadNormalizedProcessCommandLines,
      );
      if (activity !== null) {
        activities.push(activity);
      }
    }
    return activities;
  };

  private toActivity = async (
    filePath: string,
    fileName: string,
    nowEpochSeconds: number,
    loadNormalizedProcessCommandLines: () => Promise<string[]>,
  ): Promise<SubAgentActivity | null> => {
    let content: string;
    let stats: fs.Stats;
    try {
      content = fs.readFileSync(filePath, 'utf8');
      stats = fs.statSync(filePath);
    } catch {
      return null;
    }
    const transcript = parseTranscript(content);
    if (transcript.lastEntryIndicatesCompletion) {
      return null;
    }
    const silentSeconds = clampToZero(
      nowEpochSeconds - Math.floor(stats.mtimeMs / 1000),
    );
    const runningSeconds =
      transcript.firstEntryEpochSeconds === null
        ? 0
        : clampToZero(nowEpochSeconds - transcript.firstEntryEpochSeconds);
    return {
      label: fileName.replace(/\.jsonl$/, ''),
      silentSeconds,
      runningSeconds,
      waitingOnExternalProcess:
        transcript.pendingDelegationToolUse ||
        (await this.hasLiveMatchingProcess(
          transcript.pendingToolCommands,
          loadNormalizedProcessCommandLines,
        )),
    };
  };

  private hasLiveMatchingProcess = async (
    pendingToolCommands: string[],
    loadNormalizedProcessCommandLines: () => Promise<string[]>,
  ): Promise<boolean> => {
    if (pendingToolCommands.length === 0) {
      return false;
    }
    const fragments = pendingToolCommands
      .map(normalizeCommandFragment)
      .filter((fragment) => fragment.length > 0);
    if (fragments.length === 0) {
      return false;
    }
    const processCommandLines = await loadNormalizedProcessCommandLines();
    return fragments.some((fragment) =>
      processCommandLines.some((commandLine) => commandLine.includes(fragment)),
    );
  };
}
