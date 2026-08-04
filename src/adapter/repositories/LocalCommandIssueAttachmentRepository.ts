import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  IssueAttachmentRepository,
  IssueAttachmentUploadRequest,
} from '../../domain/usecases/adapter-interfaces/IssueAttachmentRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';

export const UPLOAD_COMMAND = 'upload-file-to-gh-issue';

export const sanitizeAttachmentFileName = (fileName: string): string => {
  const base = fileName.split('/').pop() ?? '';
  const sanitized = base.replace(/[^A-Za-z0-9._-]/g, '_');
  return sanitized.length === 0 ? 'attachment' : sanitized;
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
      sanitizeAttachmentFileName(request.fileName),
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
      return markdown;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
