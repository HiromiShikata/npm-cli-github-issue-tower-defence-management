import {
  extractAgentNameFromReportBody,
  isAgentReportBody,
} from './isAgentReportBody';
import { normalizeProjectFieldName } from '../entities/ProjectFieldName';

const isAgentReportMatchingIdentity = (
  content: string,
  agentFieldValue: string | null,
): boolean => {
  if (!isAgentReportBody(content)) {
    return false;
  }
  if (agentFieldValue === null) {
    return true;
  }
  const reportingAgentName = extractAgentNameFromReportBody(content);
  return (
    reportingAgentName !== null &&
    normalizeProjectFieldName(reportingAgentName) ===
      normalizeProjectFieldName(agentFieldValue)
  );
};

export const findLastAgentReport = <
  Comment extends { author: string; content: string },
>(
  comments: Comment[],
  isTrustedAuthor: (author: string) => boolean,
  agentFieldValue: string | null,
): Comment | null =>
  [...comments]
    .reverse()
    .find(
      (comment) =>
        isTrustedAuthor(comment.author) &&
        isAgentReportMatchingIdentity(comment.content, agentFieldValue),
    ) ?? null;

export const findLastAgentReportPostedSince = <
  Comment extends {
    author: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  },
>(
  comments: Comment[],
  isTrustedAuthor: (author: string) => boolean,
  postedSince: Date | null,
  agentFieldValue: string | null,
): Comment | null => {
  if (postedSince === null) {
    return findLastAgentReport(comments, isTrustedAuthor, agentFieldValue);
  }
  return (
    comments
      .filter((comment) => comment.createdAt >= postedSince)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .find(
        (comment) =>
          isTrustedAuthor(comment.author) &&
          isAgentReportMatchingIdentity(comment.content, agentFieldValue),
      ) ?? null
  );
};
