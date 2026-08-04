import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  IssueAttachmentRepository,
  IssueAttachmentUploadRequest,
} from '../../domain/usecases/adapter-interfaces/IssueAttachmentRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';

export const UPLOAD_COMMAND = 'upload-file-to-gh-issue';

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

export class LocalCommandIssueAttachmentRepository implements IssueAttachmentRepository {
  constructor(
    private readonly localCommandRunner: LocalCommandRunner,
    private readonly temporaryDirectoryRoot: string = tmpdir(),
  ) {}

  async uploadAttachment(
    request: IssueAttachmentUploadRequest,
  ): Promise<string> {
    const directory = await mkdtemp(
      join(this.temporaryDirectoryRoot, 'console-attachment-'),
    );
    const filePath = join(
      directory,
      `${UPLOAD_FILE_BASE_NAME}${resolveAttachmentExtension(request.fileName)}`,
    );
    try {
      await writeFile(filePath, request.content);
      const result = await this.localCommandRunner.runCommand(UPLOAD_COMMAND, [
        filePath,
        request.issueOrPullRequestUrl,
      ]);
      if (result.exitCode !== 0) {
        throw new Error(
          `${UPLOAD_COMMAND} failed with exit code ${result.exitCode}: ${result.stderr.trim()}`,
        );
      }
      const markdown = result.stdout.trim();
      if (markdown.length === 0) {
        throw new Error(`${UPLOAD_COMMAND} returned no markdown`);
      }
      return relabelAttachmentMarkdown(
        markdown,
        sanitizeAttachmentFileName(request.fileName),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
