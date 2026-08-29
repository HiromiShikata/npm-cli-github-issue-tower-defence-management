export interface GitHubGraphqlRateLimitRepository {
  getRemainingRequestCount(): Promise<number | null>;
}
