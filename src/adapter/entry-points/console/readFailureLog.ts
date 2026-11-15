import { HTTPError } from 'ky';
import { redactSecrets } from '../../../domain/services/secretRedaction';

const httpStatusInMessagePattern = /\bHTTP (\d{3})\b/;

const githubHttpStatusOf = (error: unknown): string => {
  if (error instanceof HTTPError) {
    return String(error.response.status);
  }
  const match =
    error instanceof Error
      ? httpStatusInMessagePattern.exec(error.message)
      : null;
  return match?.[1] ?? 'unknown';
};

export const describeGithubReadFailure = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `githubStatus=${githubHttpStatusOf(error)} error=${redactSecrets(message)}`;
};
