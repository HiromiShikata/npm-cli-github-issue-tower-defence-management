import { GitHubRateLimitError } from './githubRateLimitRetry';

export class GraphqlRateLimitError extends GitHubRateLimitError {}

export type GraphqlRateLimitErrorResponse = {
  errors?: readonly { message: string; type?: string }[];
};

export const throwIfGraphqlRateLimitError = (
  response: GraphqlRateLimitErrorResponse,
): void => {
  const rateLimitErrors = response.errors?.filter(
    (error) => error.type === 'RATE_LIMIT',
  );
  if (rateLimitErrors !== undefined && rateLimitErrors.length > 0) {
    throw new GraphqlRateLimitError(
      rateLimitErrors.map((error) => error.message).join('; '),
    );
  }
};
