import {
  BoardCache,
  BoardCacheIssue,
  StoryGateBoardCacheRepository,
} from '../adapter-interfaces/StoryGateBoardCacheRepository';
import {
  GithubIssueReference,
  IssueProjectItem,
  StoryGateGithubRequestError,
  StoryGateIssue,
  StoryGateIssueComment,
  StoryGateIssueRepository,
} from '../adapter-interfaces/StoryGateIssueRepository';
import { StoryGateProjectConfigRepository } from '../adapter-interfaces/StoryGateProjectConfigRepository';
import {
  githubIssueReferenceParse,
  githubIssueUrlsExtractInOrder,
} from './githubIssueReferenceParse';
import {
  AGENT_REPORT_PREFIX,
  COMMENT_HISTORY_FOLD_THRESHOLD,
  issueCommentsAfterLatestFold,
  issueCommentsFormatAsText,
  issueCommentsSplitByAuthorKind,
} from './issueCommentSplit';
import {
  approvedSpecificationUrlsExtract,
  isSpecificationRoutingAlreadyPosted,
} from './specificationRoutingDetect';
import { specificationSectionsDetect } from './specificationSectionDetect';
import {
  BACKLOG_MILESTONE_STORY_MARKER,
  DISABLED_STORY_OPTION_COLOR,
  hasBacklogTicketUrl,
  hasStoryIssueLabel,
  isRegularStory,
  isStoryUnset,
} from './storyValueClassify';

export const STORY_GATE_RESULT_SCHEMA_VERSION = 1;
export const STORY_GATE_RESULT_FILE_NAME = 'story-gate-result.json';

export type StoryGateAction =
  | 'PROCEED'
  | 'STOP_SILENT'
  | 'ROUTE'
  | 'SELF_RESOLVE_STORY'
  | 'FOLD_REQUIRED'
  | 'JUDGE';

export type TriageAgentSelfRouteAction = Extract<
  StoryGateAction,
  'SELF_RESOLVE_STORY' | 'PROCEED'
>;

export type StoryGateReason =
  | 'NOT_ON_ANY_BOARD'
  | 'REGULAR_STORY'
  | 'STORY_ISSUE_READ'
  | 'ISSUE_CLOSED'
  | 'STORY_ISSUE_CLOSED'
  | 'SPECIFICATION_ROUTING_ALREADY_POSTED'
  | 'ISSUE_NOT_IN_BOARD_CACHE'
  | 'STORY_NOT_ADOPTABLE'
  | 'STORY_ISSUE_NOT_FOUND'
  | 'STORY_ISSUES_NOT_READABLE'
  | 'AGENT_NOT_IN_PROJECT_AGENTS'
  | 'OPEN_PULL_REQUEST_EXISTS'
  | 'COMMENT_HISTORY_OVER_LIMIT'
  | 'WORK_MERGED_WITHOUT_APPROVED_SPECIFICATION'
  | 'TRIAGE_AGENT_CANNOT_ROUTE_TO_SELF';

export type StorySource = 'BOARD_CACHE' | 'LIVE' | 'ADOPTED' | 'NONE';

export type StoryAdoptionOutcome =
  | 'NOT_ATTEMPTED'
  | 'WRITTEN'
  | 'SKIPPED_DRY_RUN'
  | 'LIVE_STORY_ALREADY_SET'
  | 'NO_UNIQUE_LINKED_STORY'
  | 'READ_BACK_MISMATCH';

export type AgentRoutingJson = {
  nextStepAgent: string;
  returnToAgent: string;
};

export type IssueCommentFiles = {
  ownerCommentsPath: string;
  agentCommentsPath: string;
  ownerCommentCount: number;
  agentCommentCountRead: number;
  agentCommentCountTotal: number;
};

export type StoryIssueReadResult = IssueCommentFiles & {
  url: string;
  state: StoryGateIssue['state'];
  bodyPath: string;
};

export type AssignedIssueFoldMode = 'NEW_ISSUE' | 'IN_PLACE';

export type AssignedIssueSummary = {
  url: string;
  state: StoryGateIssue['state'];
  hasStoryLabel: boolean;
  commentCountTotal: number;
  commentCountAfterLatestFold: number;
  foldMode: AssignedIssueFoldMode | null;
  commentFiles: IssueCommentFiles | null;
};

export type SpecificationCandidateSource =
  'SELF' | 'LINKED_IN_BODY' | 'NAMED_IN_COMMENT';

export type SpecificationCandidate = {
  url: string;
  source: SpecificationCandidateSource;
  hasNumberedRequirements: boolean;
  hasNumberedCriteria: boolean;
};

export type SpecificationDetection = {
  candidates: SpecificationCandidate[];
  unreadableUrls: string[];
  detectedUrl: string | null;
};

export type StoryGateFacts = {
  boardCacheFilePath: string | null;
  boardCacheModifiedAt: string | null;
  liveStoryRead: boolean;
  liveProjectIds: string[];
  projectConfigFilePath: string | null;
  agentInProjectAgents: boolean | null;
  openClosingPullRequestUrls: string[] | null;
  mergedClosingPullRequestUrls: string[] | null;
  parentCandidateUrls: string[];
  parentHasApprovedSpecification: boolean | null;
  storyIssueUrlsNotFound: string[];
};

export type StoryGateResult = {
  schemaVersion: typeof STORY_GATE_RESULT_SCHEMA_VERSION;
  issueUrl: string;
  dryRun: boolean;
  action: StoryGateAction;
  reason: StoryGateReason;
  story: {
    value: string | null;
    source: StorySource;
    adoptedFromUrls: string[];
  };
  storyAdoption: { outcome: StoryAdoptionOutcome };
  routingJson: AgentRoutingJson | null;
  specificationMissingRoutingJson: AgentRoutingJson;
  activeStoryOptions: string[];
  storyIssues: StoryIssueReadResult[];
  assignedIssue: AssignedIssueSummary | null;
  specification: SpecificationDetection | null;
  facts: StoryGateFacts;
};

export type StoryGateOutputFile = {
  path: string;
  content: string;
};

export type StoryGateCheckInput = {
  issue: GithubIssueReference;
  agentName: string;
  triageAgentName: string;
  specificationAgentName: string;
  outputDirectory: string;
  dryRun: boolean;
};

export type StoryGateCheckOutput = {
  result: StoryGateResult;
  outputFiles: StoryGateOutputFile[];
};

type BoardCacheHit = {
  cache: BoardCache;
  issue: BoardCacheIssue;
};

type LinkedStoryResolution = {
  storyName: string | null;
  optionId: string | null;
  adoptedFromUrls: string[];
};

type EvaluationState = {
  result: StoryGateResult;
  outputFiles: StoryGateOutputFile[];
};

const outputPathJoin = (outputDirectory: string, fileName: string): string =>
  outputDirectory.endsWith('/')
    ? `${outputDirectory}${fileName}`
    : `${outputDirectory}/${fileName}`;

const liveStoryNameFirst = (items: IssueProjectItem[]): string | null =>
  items
    .map((item) => item.storyName)
    .find((name): name is string => name !== null && name !== '') ?? null;

const activeStoryOptionNames = (cache: BoardCache | null): string[] =>
  cache === null
    ? []
    : cache.storyOptions
        .filter((option) => option.color !== DISABLED_STORY_OPTION_COLOR)
        .map((option) => option.name);

export class StoryGateCheckUseCase {
  constructor(
    private readonly issueRepository: StoryGateIssueRepository,
    private readonly boardCacheRepository: StoryGateBoardCacheRepository,
    private readonly projectConfigRepository: StoryGateProjectConfigRepository,
  ) {}

  run = async (input: StoryGateCheckInput): Promise<StoryGateCheckOutput> => {
    const caches = await this.boardCacheRepository.listBoardCachesNewestFirst();
    const cacheHit = this.boardCacheHitFind(caches, input.issue.url);
    const state = this.evaluationStateCreate(input, cacheHit);
    const facts = state.result.facts;
    const cachedStory = cacheHit?.issue.story ?? null;
    let storyValue: string | null = isStoryUnset(cachedStory)
      ? null
      : cachedStory;
    let liveItems: IssueProjectItem[] | null = null;
    if (cacheHit === null || storyValue === null) {
      liveItems = await this.issueProjectItemsRead(input.issue);
      facts.liveStoryRead = true;
      facts.liveProjectIds = liveItems.map((item) => item.projectId);
      const liveStory = liveStoryNameFirst(liveItems);
      if (!isStoryUnset(liveStory)) {
        storyValue = liveStory;
        state.result.story.source = 'LIVE';
      }
    } else {
      state.result.story.source = 'BOARD_CACHE';
    }
    state.result.story.value = storyValue;

    if (storyValue === null) {
      if (cacheHit === null) {
        const itemsOnCachedBoards = (liveItems ?? []).filter((item) =>
          caches.some((cache) => cache.projectId === item.projectId),
        );
        if (itemsOnCachedBoards.length > 0) {
          return this.routeToTriage(
            state,
            input,
            'ISSUE_NOT_IN_BOARD_CACHE',
            'PROCEED',
          );
        }
        return this.assignedIssueEvaluate(
          state,
          input,
          caches,
          'NOT_ON_ANY_BOARD',
        );
      }
      storyValue = await this.storyAdopt(state, input, cacheHit);
      if (storyValue === null) {
        return this.storyUnadoptableEvaluate(state, input);
      }
    }

    if (isRegularStory(storyValue)) {
      return this.assignedIssueEvaluate(state, input, caches, 'REGULAR_STORY');
    }
    const searchCaches = await this.storyGateSearchCachesResolve(
      caches,
      cacheHit,
      input.issue.owner,
    );
    const storyIssueUrls = this.storyIssueUrlsFind(searchCaches, storyValue);
    if (storyIssueUrls.length === 0) {
      return this.routeToTriage(
        state,
        input,
        'STORY_ISSUE_NOT_FOUND',
        'PROCEED',
      );
    }
    await this.storyIssuesRead(state, input, storyIssueUrls);
    if (state.result.storyIssues.length === 0) {
      return this.routeToTriage(
        state,
        input,
        'STORY_ISSUES_NOT_READABLE',
        'PROCEED',
      );
    }
    return this.assignedIssueEvaluate(state, input, caches, 'STORY_ISSUE_READ');
  };

  private evaluationStateCreate = (
    input: StoryGateCheckInput,
    cacheHit: BoardCacheHit | null,
  ): EvaluationState => ({
    result: {
      schemaVersion: STORY_GATE_RESULT_SCHEMA_VERSION,
      issueUrl: input.issue.url,
      dryRun: input.dryRun,
      action: 'PROCEED',
      reason: 'NOT_ON_ANY_BOARD',
      story: { value: null, source: 'NONE', adoptedFromUrls: [] },
      storyAdoption: { outcome: 'NOT_ATTEMPTED' },
      routingJson: null,
      specificationMissingRoutingJson: {
        nextStepAgent: input.specificationAgentName,
        returnToAgent: input.agentName,
      },
      activeStoryOptions: activeStoryOptionNames(cacheHit?.cache ?? null),
      storyIssues: [],
      assignedIssue: null,
      specification: null,
      facts: {
        boardCacheFilePath: cacheHit?.cache.filePath ?? null,
        boardCacheModifiedAt: cacheHit?.cache.modifiedAt.toISOString() ?? null,
        liveStoryRead: false,
        liveProjectIds: [],
        projectConfigFilePath: null,
        agentInProjectAgents: null,
        openClosingPullRequestUrls: null,
        mergedClosingPullRequestUrls: null,
        parentCandidateUrls: [],
        parentHasApprovedSpecification: null,
        storyIssueUrlsNotFound: [],
      },
    },
    outputFiles: [],
  });

  private boardCacheHitFind = (
    caches: BoardCache[],
    issueUrl: string,
  ): BoardCacheHit | null => {
    for (const cache of caches) {
      const issue = cache.issues.find((cached) => cached.url === issueUrl);
      if (issue) {
        return { cache, issue };
      }
    }
    return null;
  };

  private issueProjectItemsRead = async (
    issue: GithubIssueReference,
  ): Promise<IssueProjectItem[]> => {
    const snapshot = await this.issueRepository.findIssueProjectItems(issue);
    if (snapshot === null) {
      throw new StoryGateGithubRequestError(
        `Issue not found or not readable with the given token: ${issue.url}`,
      );
    }
    return snapshot.items;
  };

  private decide = (
    state: EvaluationState,
    action: StoryGateAction,
    reason: StoryGateReason,
  ): StoryGateCheckOutput => {
    state.result.action = action;
    state.result.reason = reason;
    return { result: state.result, outputFiles: state.outputFiles };
  };

  private routeToTriage = (
    state: EvaluationState,
    input: StoryGateCheckInput,
    reason: StoryGateReason,
    selfRouteAction: TriageAgentSelfRouteAction,
  ): StoryGateCheckOutput => {
    if (input.agentName === input.triageAgentName) {
      return this.decide(
        state,
        selfRouteAction,
        'TRIAGE_AGENT_CANNOT_ROUTE_TO_SELF',
      );
    }
    state.result.routingJson = {
      nextStepAgent: input.triageAgentName,
      returnToAgent: input.agentName,
    };
    return this.decide(state, 'ROUTE', reason);
  };

  private linkedStoryResolve = async (
    cacheHit: BoardCacheHit,
  ): Promise<LinkedStoryResolution> => {
    const unresolved: LinkedStoryResolution = {
      storyName: null,
      optionId: null,
      adoptedFromUrls: [],
    };
    const body = cacheHit.issue.body.trimStart();
    if (
      !body.startsWith(AGENT_REPORT_PREFIX) ||
      cacheHit.cache.storyFieldId === null
    ) {
      return unresolved;
    }
    const cachedByUrl = new Map(
      cacheHit.cache.issues.map((cached) => [cached.url, cached]),
    );
    const urlsByStoryName = new Map<string, string[]>();
    for (const linkedUrl of githubIssueUrlsExtractInOrder(body)) {
      if (urlsByStoryName.size >= 2) {
        break;
      }
      if (linkedUrl === cacheHit.issue.url) {
        continue;
      }
      const cached = cachedByUrl.get(linkedUrl);
      const linkedStory = cached
        ? (cached.story ?? '')
        : await this.linkedLiveStoryRead(linkedUrl, cacheHit.cache.projectId);
      const option = cacheHit.cache.storyOptions.find(
        (candidate) => candidate.name === linkedStory,
      );
      if (
        option === undefined ||
        isStoryUnset(linkedStory) ||
        option.color === DISABLED_STORY_OPTION_COLOR ||
        (linkedStory.includes(BACKLOG_MILESTONE_STORY_MARKER) &&
          !hasBacklogTicketUrl(body))
      ) {
        continue;
      }
      urlsByStoryName.set(linkedStory, [
        ...(urlsByStoryName.get(linkedStory) ?? []),
        linkedUrl,
      ]);
    }
    if (urlsByStoryName.size !== 1) {
      return unresolved;
    }
    const [storyName, adoptedFromUrls] = [...urlsByStoryName.entries()][0];
    const option = cacheHit.cache.storyOptions.find(
      (candidate) => candidate.name === storyName,
    );
    return {
      storyName,
      optionId: option?.id ?? null,
      adoptedFromUrls,
    };
  };

  private linkedLiveStoryRead = async (
    linkedUrl: string,
    projectId: string,
  ): Promise<string> => {
    const linkedIssue = githubIssueReferenceParse(linkedUrl);
    if (linkedIssue === null) {
      return '';
    }
    const snapshot =
      await this.issueRepository.findIssueProjectItems(linkedIssue);
    if (snapshot === null) {
      return '';
    }
    return (
      liveStoryNameFirst(
        snapshot.items.filter((item) => item.projectId === projectId),
      ) ?? ''
    );
  };

  private storyAdopt = async (
    state: EvaluationState,
    input: StoryGateCheckInput,
    cacheHit: BoardCacheHit,
  ): Promise<string | null> => {
    const resolution = await this.linkedStoryResolve(cacheHit);
    if (
      resolution.storyName === null ||
      resolution.optionId === null ||
      cacheHit.cache.storyFieldId === null
    ) {
      state.result.storyAdoption.outcome = 'NO_UNIQUE_LINKED_STORY';
      return null;
    }
    const liveStory = liveStoryNameFirst(
      await this.issueProjectItemsRead(input.issue),
    );
    if (!isStoryUnset(liveStory)) {
      state.result.storyAdoption.outcome = 'LIVE_STORY_ALREADY_SET';
      state.result.story = {
        value: liveStory,
        source: 'LIVE',
        adoptedFromUrls: [],
      };
      return liveStory;
    }
    if (input.dryRun) {
      state.result.storyAdoption.outcome = 'SKIPPED_DRY_RUN';
      state.result.story = {
        value: resolution.storyName,
        source: 'ADOPTED',
        adoptedFromUrls: resolution.adoptedFromUrls,
      };
      return resolution.storyName;
    }
    await this.issueRepository.updateProjectItemSingleSelectValue({
      projectId: cacheHit.cache.projectId,
      itemId: cacheHit.issue.itemId,
      fieldId: cacheHit.cache.storyFieldId,
      optionId: resolution.optionId,
    });
    const readBackStory = liveStoryNameFirst(
      (await this.issueProjectItemsRead(input.issue)).filter(
        (item) => item.projectId === cacheHit.cache.projectId,
      ),
    );
    if (readBackStory !== resolution.storyName) {
      state.result.storyAdoption.outcome = 'READ_BACK_MISMATCH';
      return null;
    }
    state.result.storyAdoption.outcome = 'WRITTEN';
    state.result.story = {
      value: resolution.storyName,
      source: 'ADOPTED',
      adoptedFromUrls: resolution.adoptedFromUrls,
    };
    return resolution.storyName;
  };

  private storyUnadoptableEvaluate = async (
    state: EvaluationState,
    input: StoryGateCheckInput,
  ): Promise<StoryGateCheckOutput> => {
    const configs = await this.projectConfigRepository.listProjectConfigs();
    const config = configs.find(
      (candidate) =>
        candidate.org.toLowerCase() === input.issue.owner.toLowerCase(),
    );
    if (config === undefined) {
      return this.routeToTriage(
        state,
        input,
        'STORY_NOT_ADOPTABLE',
        'SELF_RESOLVE_STORY',
      );
    }
    state.result.facts.projectConfigFilePath = config.filePath;
    const agentInProjectAgents = config.agents.includes(input.agentName);
    state.result.facts.agentInProjectAgents = agentInProjectAgents;
    if (!agentInProjectAgents) {
      return this.decide(
        state,
        'SELF_RESOLVE_STORY',
        'AGENT_NOT_IN_PROJECT_AGENTS',
      );
    }
    const openClosingPullRequestUrls = (
      await this.closingPullRequestsRecord(state, input.issue)
    ).openUrls;
    if (openClosingPullRequestUrls.length > 0) {
      return this.decide(
        state,
        'SELF_RESOLVE_STORY',
        'OPEN_PULL_REQUEST_EXISTS',
      );
    }
    return this.routeToTriage(
      state,
      input,
      'STORY_NOT_ADOPTABLE',
      'SELF_RESOLVE_STORY',
    );
  };

  private closingPullRequestsRecord = async (
    state: EvaluationState,
    issue: GithubIssueReference,
  ): Promise<{ openUrls: string[]; mergedUrls: string[] }> => {
    const closingPullRequests =
      await this.issueRepository.listClosingPullRequests(issue);
    const openUrls = closingPullRequests
      .filter((pullRequest) => pullRequest.state === 'OPEN')
      .map((pullRequest) => pullRequest.url);
    const mergedUrls = closingPullRequests
      .filter((pullRequest) => pullRequest.state === 'MERGED')
      .map((pullRequest) => pullRequest.url);
    state.result.facts.openClosingPullRequestUrls = openUrls;
    state.result.facts.mergedClosingPullRequestUrls = mergedUrls;
    return { openUrls, mergedUrls };
  };

  private boardCacheOwnerDetect = (cache: BoardCache): string | null => {
    const issueUrl = cache.issues.find((issue) => issue.url !== '')?.url;
    const storyIssueUrl = Object.values(cache.storyIssueUrlByOptionName).find(
      (url) => url !== '',
    );
    const candidateUrl = issueUrl ?? storyIssueUrl;
    if (candidateUrl === undefined) {
      return null;
    }
    return githubIssueReferenceParse(candidateUrl)?.owner ?? null;
  };

  private storyGateSearchCachesResolve = async (
    caches: BoardCache[],
    cacheHit: BoardCacheHit | null,
    issueOwner: string,
  ): Promise<BoardCache[]> => {
    if (cacheHit !== null) {
      return [cacheHit.cache];
    }
    const configs = await this.projectConfigRepository.listProjectConfigs();
    const config = configs.find(
      (candidate) => candidate.org.toLowerCase() === issueOwner.toLowerCase(),
    );
    if (config === undefined) {
      return [];
    }
    return caches.filter(
      (cache) =>
        this.boardCacheOwnerDetect(cache)?.toLowerCase() ===
        config.org.toLowerCase(),
    );
  };

  private storyIssueUrlsFind = (
    caches: BoardCache[],
    storyValue: string,
  ): string[] => {
    const urls: string[] = [];
    const urlAdd = (url: string): void => {
      if (url !== '' && !urls.includes(url)) {
        urls.push(url);
      }
    };
    for (const cache of caches) {
      const precomputedUrl = cache.storyIssueUrlByOptionName[storyValue];
      if (precomputedUrl !== undefined && precomputedUrl !== '') {
        urlAdd(precomputedUrl);
        continue;
      }
      cache.issues
        .filter(
          (cached) =>
            cached.story === storyValue && hasStoryIssueLabel(cached.labels),
        )
        .forEach((cached) => urlAdd(cached.url));
    }
    return urls;
  };

  private commentFilesWrite = (
    state: EvaluationState,
    input: StoryGateCheckInput,
    fileNamePrefix: string,
    comments: StoryGateIssueComment[],
  ): IssueCommentFiles => {
    const split = issueCommentsSplitByAuthorKind(comments);
    const ownerCommentsPath = outputPathJoin(
      input.outputDirectory,
      `${fileNamePrefix}-owner-comments.md`,
    );
    const agentCommentsPath = outputPathJoin(
      input.outputDirectory,
      `${fileNamePrefix}-agent-comments-newest-first.md`,
    );
    state.outputFiles.push(
      {
        path: ownerCommentsPath,
        content: issueCommentsFormatAsText(split.ownerComments),
      },
      {
        path: agentCommentsPath,
        content: issueCommentsFormatAsText(split.agentCommentsNewestFirst),
      },
    );
    return {
      ownerCommentsPath,
      agentCommentsPath,
      ownerCommentCount: split.ownerCommentCount,
      agentCommentCountRead: split.agentCommentCountRead,
      agentCommentCountTotal: split.agentCommentCountTotal,
    };
  };

  private storyIssuesRead = async (
    state: EvaluationState,
    input: StoryGateCheckInput,
    storyIssueUrls: string[],
  ): Promise<void> => {
    for (const storyIssueUrl of storyIssueUrls) {
      const storyIssueReference = githubIssueReferenceParse(storyIssueUrl);
      const storyIssue =
        storyIssueReference === null
          ? null
          : await this.issueRepository.findIssue(storyIssueReference);
      if (storyIssueReference === null || storyIssue === null) {
        state.result.facts.storyIssueUrlsNotFound.push(storyIssueUrl);
        continue;
      }
      const comments =
        await this.issueRepository.listIssueComments(storyIssueReference);
      const fileNamePrefix = `story-issue-${state.result.storyIssues.length + 1}`;
      const bodyPath = outputPathJoin(
        input.outputDirectory,
        `${fileNamePrefix}-body.md`,
      );
      state.outputFiles.push({ path: bodyPath, content: storyIssue.body });
      state.result.storyIssues.push({
        url: storyIssueUrl,
        state: storyIssue.state,
        bodyPath,
        ...this.commentFilesWrite(state, input, fileNamePrefix, comments),
      });
    }
  };

  private assignedIssueEvaluate = async (
    state: EvaluationState,
    input: StoryGateCheckInput,
    caches: BoardCache[],
    proceedReason: StoryGateReason,
  ): Promise<StoryGateCheckOutput> => {
    const assignedIssue = await this.issueRepository.findIssue(input.issue);
    if (assignedIssue === null) {
      throw new StoryGateGithubRequestError(
        `Issue not found or not readable with the given token: ${input.issue.url}`,
      );
    }
    const comments = await this.issueRepository.listIssueComments(input.issue);
    const hasStoryLabel = hasStoryIssueLabel(assignedIssue.labels);
    const commentCountAfterLatestFold =
      issueCommentsAfterLatestFold(comments).length;
    const foldMode = this.assignedIssueFoldModeDecide(
      hasStoryLabel,
      comments.length,
      commentCountAfterLatestFold,
    );
    state.result.assignedIssue = {
      url: input.issue.url,
      state: assignedIssue.state,
      hasStoryLabel,
      commentCountTotal: comments.length,
      commentCountAfterLatestFold,
      foldMode,
      commentFiles: hasStoryLabel
        ? this.commentFilesWrite(state, input, 'assigned-issue', comments)
        : null,
    };
    if (assignedIssue.state === 'CLOSED') {
      return this.decide(state, 'STOP_SILENT', 'ISSUE_CLOSED');
    }
    if (
      state.result.storyIssues.length > 0 &&
      state.result.storyIssues.every(
        (storyIssue) => storyIssue.state === 'CLOSED',
      )
    ) {
      return this.decide(state, 'STOP_SILENT', 'STORY_ISSUE_CLOSED');
    }
    const latestComment = comments[comments.length - 1];
    if (
      input.agentName !== input.specificationAgentName &&
      latestComment !== undefined &&
      isSpecificationRoutingAlreadyPosted(
        latestComment.body,
        input.specificationAgentName,
      )
    ) {
      return this.decide(
        state,
        'STOP_SILENT',
        'SPECIFICATION_ROUTING_ALREADY_POSTED',
      );
    }
    const specification = await this.specificationDetect(
      input,
      caches,
      assignedIssue,
      comments,
    );
    state.result.specification = specification;
    const parentCandidates = specification.candidates.filter(
      (candidate) => candidate.source !== 'SELF',
    );
    state.result.facts.parentCandidateUrls = [
      ...parentCandidates.map((candidate) => candidate.url),
      ...specification.unreadableUrls,
    ];
    state.result.facts.parentHasApprovedSpecification = parentCandidates.some(
      (candidate) =>
        candidate.hasNumberedRequirements && candidate.hasNumberedCriteria,
    );
    if (specification.detectedUrl === null) {
      const { mergedUrls } = await this.closingPullRequestsRecord(
        state,
        input.issue,
      );
      if (mergedUrls.length > 0) {
        return this.decide(
          state,
          'JUDGE',
          'WORK_MERGED_WITHOUT_APPROVED_SPECIFICATION',
        );
      }
    }
    if (foldMode !== null) {
      return this.decide(state, 'FOLD_REQUIRED', 'COMMENT_HISTORY_OVER_LIMIT');
    }
    return this.decide(state, 'PROCEED', proceedReason);
  };

  private assignedIssueFoldModeDecide = (
    hasStoryLabel: boolean,
    commentCountTotal: number,
    commentCountAfterLatestFold: number,
  ): AssignedIssueFoldMode | null => {
    if (hasStoryLabel) {
      return commentCountAfterLatestFold > COMMENT_HISTORY_FOLD_THRESHOLD
        ? 'IN_PLACE'
        : null;
    }
    return commentCountTotal > COMMENT_HISTORY_FOLD_THRESHOLD
      ? 'NEW_ISSUE'
      : null;
  };

  private specificationDetect = async (
    input: StoryGateCheckInput,
    caches: BoardCache[],
    assignedIssue: StoryGateIssue,
    comments: StoryGateIssueComment[],
  ): Promise<SpecificationDetection> => {
    const candidateUrls: {
      url: string;
      source: SpecificationCandidateSource;
    }[] = [];
    const candidateAdd = (
      url: string,
      source: SpecificationCandidateSource,
    ): void => {
      if (!candidateUrls.some((candidate) => candidate.url === url)) {
        candidateUrls.push({ url, source });
      }
    };
    candidateAdd(input.issue.url, 'SELF');
    githubIssueUrlsExtractInOrder(assignedIssue.body).forEach((url) =>
      candidateAdd(url, 'LINKED_IN_BODY'),
    );
    comments
      .flatMap((comment) => approvedSpecificationUrlsExtract(comment.body))
      .forEach((url) => candidateAdd(url, 'NAMED_IN_COMMENT'));

    const candidates: SpecificationCandidate[] = [];
    const unreadableUrls: string[] = [];
    for (const candidateUrl of candidateUrls) {
      const body =
        candidateUrl.source === 'SELF'
          ? assignedIssue.body
          : await this.issueBodyRead(caches, candidateUrl.url);
      if (body === null) {
        unreadableUrls.push(candidateUrl.url);
        continue;
      }
      candidates.push({
        ...candidateUrl,
        ...specificationSectionsDetect(body),
      });
    }
    const detected = candidates.find(
      (candidate) =>
        candidate.hasNumberedRequirements && candidate.hasNumberedCriteria,
    );
    return {
      candidates,
      unreadableUrls,
      detectedUrl: detected?.url ?? null,
    };
  };

  private issueBodyRead = async (
    caches: BoardCache[],
    issueUrl: string,
  ): Promise<string | null> => {
    const cacheHit = this.boardCacheHitFind(caches, issueUrl);
    if (cacheHit !== null) {
      return cacheHit.issue.body;
    }
    const issueReference = githubIssueReferenceParse(issueUrl);
    if (issueReference === null) {
      return null;
    }
    let issue: StoryGateIssue | null;
    try {
      issue = await this.issueRepository.findIssue(issueReference);
    } catch (error) {
      if (
        error instanceof StoryGateGithubRequestError &&
        error.status === 403
      ) {
        return null;
      }
      throw error;
    }
    return issue?.body ?? null;
  };
}
