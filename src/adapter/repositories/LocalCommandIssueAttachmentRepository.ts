import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  IssueAttachmentRepository,
  IssueAttachmentUploadRequest,
  IssueAttachmentUploadResult,
} from '../../domain/usecases/adapter-interfaces/IssueAttachmentRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';

export const UPLOAD_COMMAND = 'upload-file-to-gh-issue';

export type IssueAttachmentGithubTokenResolver = (
  issueOrPullRequestUrl: string,
) => string;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.pdf',
  '.txt',
  '.md',
  '.log',
  '.csv',
  '.json',
  '.zip',
  '.mov',
  '.mp4',
] as const;

export const UPLOAD_FILE_BASE_NAME = 'attachment';
export const UPLOAD_COMMAND_DEADLINE_MS = 300000;
export const ATTACHMENT_UPLOAD_BACKSTOP_TIMEOUT_MS =
  UPLOAD_COMMAND_DEADLINE_MS + 30000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

export const sanitizeAttachmentFileName = (fileName: string): string => {
  const base = fileName.split('/').pop() ?? '';
  const sanitized = base.replace(/[^A-Za-z0-9._-]/g, '_');
  return sanitized.length === 0 ? UPLOAD_FILE_BASE_NAME : sanitized;
};

export const resolveAttachmentExtension = (fileName: string): string => {
  const lower = sanitizeAttachmentFileName(fileName).toLowerCase();
  const matched = ALLOWED_ATTACHMENT_EXTENSIONS.find((extension) =>
    lower.endsWith(extension),
  );
  return matched === undefined ? '' : matched;
};

export const relabelAttachmentMarkdown = (
  markdown: string,
  label: string,
): string => {
  const match = /^(!?)\[[^\]]*\]\((.*)\)$/.exec(markdown);
  if (match === null) {
    return markdown;
  }
  return `${match[1]}[${label}](${match[2]})`;
};

const relabelBatchAttachmentMarkdown = (
  markdown: string,
  fileName: string,
): string => {
  const sanitizedFileName = sanitizeAttachmentFileName(fileName);
  const label =
    markdown.startsWith('![') && !/\.(png|jpe?g|gif|webp|svg)$/i.test(fileName)
      ? `${sanitizedFileName.replace(/\.[^.]*$/, '')}.png`
      : sanitizedFileName;
  return relabelAttachmentMarkdown(markdown, label);
};

export class LocalCommandIssueAttachmentRepository implements IssueAttachmentRepository {
  constructor(
    private readonly localCommandRunner: LocalCommandRunner,
    private readonly resolveGithubToken: IssueAttachmentGithubTokenResolver,
    private readonly temporaryDirectoryRoot: string = tmpdir(),
  ) {}

  async uploadAttachment(
    request: IssueAttachmentUploadRequest,
  ): Promise<IssueAttachmentUploadResult[] | string> {
    const isBatchUpload = 'files' in request;
    const files = isBatchUpload
      ? request.files
      : [{ fileName: request.fileName, content: request.content }];
    const directory = await mkdtemp(
      join(this.temporaryDirectoryRoot, 'console-attachment-'),
    );
    const filePaths = files.map((file, index) =>
      join(
        directory,
        `${UPLOAD_FILE_BASE_NAME}${isBatchUpload ? `-${index}` : ''}${resolveAttachmentExtension(file.fileName)}`,
      ),
    );
    try {
      await Promise.all(
        files.map((file, index) => writeFile(filePaths[index], file.content)),
      );
      if (!isBatchUpload) {
        const result = await this.localCommandRunner.runCommand(
          UPLOAD_COMMAND,
          [filePaths[0], request.issueOrPullRequestUrl],
          {
            env: {
              GH_TOKEN: this.resolveGithubToken(request.issueOrPullRequestUrl),
            },
          },
        );
        if (result.exitCode !== 0) {
          throw new Error(
            `${UPLOAD_COMMAND} failed with exit code ${result.exitCode}: ${result.stderr.trim()}`,
          );
        }
        const markdown = result.stdout.trim();
        if (markdown.length === 0)
          throw new Error(`${UPLOAD_COMMAND} returned no markdown`);
        return relabelAttachmentMarkdown(
          markdown,
          sanitizeAttachmentFileName(files[0].fileName),
        );
      }
      const result = await this.localCommandRunner.runCommand(
        UPLOAD_COMMAND,
        ['--output-format=jsonl', ...filePaths, request.issueOrPullRequestUrl],
        {
          env: {
            GH_TOKEN: this.resolveGithubToken(request.issueOrPullRequestUrl),
          },
          timeout: ATTACHMENT_UPLOAD_BACKSTOP_TIMEOUT_MS,
          killSignal: 'SIGTERM',
          killProcessGroup: true,
        },
      );
      const records = new Map<
        string,
        { status: string; markdown?: string; error?: string }
      >();
      for (const line of result.stdout
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean)) {
        try {
          const record: unknown = JSON.parse(line);
          if (isRecord(record) && typeof record.filePath === 'string') {
            records.set(record.filePath, {
              status:
                'status' in record && typeof record.status === 'string'
                  ? record.status
                  : '',
              ...(typeof record.markdown === 'string'
                ? { markdown: record.markdown }
                : {}),
              ...(typeof record.error === 'string'
                ? { error: record.error }
                : {}),
            });
          }
        } catch {
          continue;
        }
      }
      const fallbackError =
        result.stderr.trim() ||
        `${UPLOAD_COMMAND} failed with exit code ${result.exitCode}`;
      const results: IssueAttachmentUploadResult[] = files.map(
        (file, index) => {
          const record = records.get(filePaths[index]);
          if (
            record?.status === 'uploaded' &&
            typeof record.markdown === 'string'
          ) {
            return {
              fileName: file.fileName,
              status: 'uploaded' as const,
              markdown: relabelBatchAttachmentMarkdown(
                record.markdown,
                file.fileName,
              ),
            };
          }
          return {
            fileName: file.fileName,
            status: 'failed' as const,
            error: record?.error ?? fallbackError,
          };
        },
      );
      if (!isBatchUpload) {
        const result = results[0];
        if (result?.status === 'uploaded') return result.markdown;
        throw new Error(
          `${UPLOAD_COMMAND} failed with exit code ${result?.error ?? result?.status}`,
        );
      }
      return results;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
