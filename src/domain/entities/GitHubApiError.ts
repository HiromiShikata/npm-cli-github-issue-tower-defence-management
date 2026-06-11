export class GitHubApiError {
  readonly userMessage: string;
  constructor(userMessage: string) {
    this.userMessage = userMessage;
  }
}
