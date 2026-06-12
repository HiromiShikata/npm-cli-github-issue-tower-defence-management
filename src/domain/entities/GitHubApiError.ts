export class GitHubApiError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string) {
    super();
    this.userMessage = userMessage;
  }
}
