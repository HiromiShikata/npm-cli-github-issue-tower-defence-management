export type RepositoryReference = {
  owner: string;
  repo: string;
};

export type ProjectScopeConfig = {
  org: string;
  projectUrl?: string | null;
  repositories?: string[] | null;
};

export type ProjectRepositoryScope = {
  org: string;
  repositories: string[] | null;
  listedRepositoriesOfOtherProjects: string[];
  ownsUnlistedRepositoriesOfOwner: boolean;
};

const REPOSITORY_LIST_ENTRY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export const isRepositoryListEntry = (value: string): boolean =>
  REPOSITORY_LIST_ENTRY_PATTERN.test(value);

export const repositoryKeyOf = (reference: RepositoryReference): string =>
  `${reference.owner}/${reference.repo}`.toLowerCase();

export const projectUrlKeyOf = (projectUrl: string): string =>
  projectUrl.trim().replace(/\/+$/, '').toLowerCase();

export const isRepositoryListed = (config: ProjectScopeConfig): boolean =>
  (config.repositories ?? null) !== null;

export const projectUrlMatches = (
  left: string | null,
  right: string | null,
): boolean =>
  left !== null &&
  right !== null &&
  projectUrlKeyOf(left) === projectUrlKeyOf(right);

const configListsRepository = (
  config: ProjectScopeConfig,
  reference: RepositoryReference,
): boolean =>
  isRepositoryListed(config) &&
  (config.repositories ?? []).some(
    (entry) => entry.toLowerCase() === repositoryKeyOf(reference),
  );

export const projectConfigForRepositoryResolve = <T extends ProjectScopeConfig>(
  configs: T[],
  reference: RepositoryReference,
): T | null => {
  const listedConfig =
    configs.find((config) => configListsRepository(config, reference)) ?? null;
  if (listedConfig !== null) {
    return listedConfig;
  }
  const sameOwnerConfigs = configs.filter(
    (config) => config.org.toLowerCase() === reference.owner.toLowerCase(),
  );
  return sameOwnerConfigs.find((config) => !isRepositoryListed(config)) ?? null;
};

const listedInScope = (scope: ProjectRepositoryScope, key: string): boolean =>
  scope.repositories?.some((entry) => entry.toLowerCase() === key) === true;

const listedByOtherProject = (
  scope: ProjectRepositoryScope,
  key: string,
): boolean =>
  scope.listedRepositoriesOfOtherProjects.some(
    (entry) => entry.toLowerCase() === key,
  );

export const issueBelongsToProjectScope = (
  issue: RepositoryReference,
  scope: ProjectRepositoryScope,
): boolean => {
  const key = repositoryKeyOf(issue);
  if (listedInScope(scope, key)) {
    return true;
  }
  if (listedByOtherProject(scope, key)) {
    return false;
  }
  if (scope.repositories !== null) {
    return false;
  }
  return issue.owner === scope.org;
};

export const issueAddableByProjectScope = (
  issue: RepositoryReference,
  scope: ProjectRepositoryScope,
): boolean => {
  if (scope.repositories !== null) {
    return issueBelongsToProjectScope(issue, scope);
  }
  return !listedByOtherProject(scope, repositoryKeyOf(issue));
};
