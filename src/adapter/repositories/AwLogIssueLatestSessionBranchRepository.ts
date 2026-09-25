import * as fs from 'fs';
import * as path from 'path';
import type { Issue } from '../../domain/entities/Issue';
import type { IssueLatestSessionBranchRepository } from '../../domain/usecases/adapter-interfaces/IssueLatestSessionBranchRepository';

const AW_LOG_HEADER_MAXIMUM_BYTES = 65536;
const AW_LOG_START_TIMESTAMP_SUFFIX_PATTERN = /^\d{8}_\d{6}\.log$/;
const AW_LOG_WORKING_DIRECTORY_LINE_PATTERN = /^Current directory: (.+)$/m;
const GIT_DIRECTORY_POINTER_LINE_PATTERN = /^gitdir: (.+)$/m;
const GIT_HEAD_BRANCH_REFERENCE_LINE_PATTERN = /^ref: refs\/heads\/(.+)$/m;

const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class AwLogIssueLatestSessionBranchRepository implements IssueLatestSessionBranchRepository {
  constructor(private readonly awLogDirectoryPath: string | null) {}

  findBranchNameByIssue = async (
    issue: Pick<Issue, 'org' | 'repo' | 'number'>,
  ): Promise<string | null> => {
    if (this.awLogDirectoryPath === null) {
      return null;
    }
    const latestAwLogPath = await this.findLatestAwLogPath(
      this.awLogDirectoryPath,
      issue,
    );
    if (latestAwLogPath === null) {
      return null;
    }
    const workingDirectoryPath =
      await this.readWorkingDirectoryPath(latestAwLogPath);
    if (workingDirectoryPath === null) {
      return null;
    }
    return this.readCheckedOutBranchName(workingDirectoryPath);
  };

  private findLatestAwLogPath = async (
    awLogDirectoryPath: string,
    issue: Pick<Issue, 'org' | 'repo' | 'number'>,
  ): Promise<string | null> => {
    let awLogFileNames: string[];
    try {
      awLogFileNames = await fs.promises.readdir(awLogDirectoryPath);
    } catch (error) {
      console.warn(
        `AwLogIssueLatestSessionBranchRepository: cannot list the aw log directory ${awLogDirectoryPath}: ${errorMessageOf(error)}`,
      );
      return null;
    }
    const issueAwLogFileNamePrefix = `${issue.org}_${issue.repo}_${issue.number}_`;
    const issueAwLogFileNames = awLogFileNames
      .filter(
        (fileName) =>
          fileName.startsWith(issueAwLogFileNamePrefix) &&
          AW_LOG_START_TIMESTAMP_SUFFIX_PATTERN.test(
            fileName.slice(issueAwLogFileNamePrefix.length),
          ),
      )
      .sort();
    const latestAwLogFileName = issueAwLogFileNames.at(-1);
    return latestAwLogFileName === undefined
      ? null
      : path.join(awLogDirectoryPath, latestAwLogFileName);
  };

  private readWorkingDirectoryPath = async (
    awLogPath: string,
  ): Promise<string | null> => {
    let awLogHeader: string;
    try {
      awLogHeader = await this.readFileHeader(awLogPath);
    } catch (error) {
      console.warn(
        `AwLogIssueLatestSessionBranchRepository: cannot read the aw log ${awLogPath}: ${errorMessageOf(error)}`,
      );
      return null;
    }
    const workingDirectoryMatch =
      AW_LOG_WORKING_DIRECTORY_LINE_PATTERN.exec(awLogHeader);
    if (workingDirectoryMatch === null) {
      console.warn(
        `AwLogIssueLatestSessionBranchRepository: the aw log ${awLogPath} records no working directory`,
      );
      return null;
    }
    return workingDirectoryMatch[1].trim();
  };

  private readFileHeader = async (filePath: string): Promise<string> => {
    const fileHandle = await fs.promises.open(filePath, 'r');
    try {
      const headerBuffer = Buffer.alloc(AW_LOG_HEADER_MAXIMUM_BYTES);
      const { bytesRead } = await fileHandle.read(
        headerBuffer,
        0,
        AW_LOG_HEADER_MAXIMUM_BYTES,
        0,
      );
      return headerBuffer.subarray(0, bytesRead).toString('utf8');
    } finally {
      await fileHandle.close();
    }
  };

  private readCheckedOutBranchName = async (
    workingDirectoryPath: string,
  ): Promise<string | null> => {
    let gitHeadFileContent: string;
    try {
      const gitDirectoryPath =
        await this.resolveGitDirectoryPath(workingDirectoryPath);
      gitHeadFileContent = await fs.promises.readFile(
        path.join(gitDirectoryPath, 'HEAD'),
        'utf8',
      );
    } catch (error) {
      console.warn(
        `AwLogIssueLatestSessionBranchRepository: cannot read the checked-out branch of the working directory ${workingDirectoryPath}: ${errorMessageOf(error)}`,
      );
      return null;
    }
    const branchReferenceMatch =
      GIT_HEAD_BRANCH_REFERENCE_LINE_PATTERN.exec(gitHeadFileContent);
    return branchReferenceMatch === null
      ? null
      : branchReferenceMatch[1].trim();
  };

  private resolveGitDirectoryPath = async (
    workingDirectoryPath: string,
  ): Promise<string> => {
    const dotGitPath = path.join(workingDirectoryPath, '.git');
    const dotGitStats = await fs.promises.stat(dotGitPath);
    if (dotGitStats.isDirectory()) {
      return dotGitPath;
    }
    const dotGitFileContent = await fs.promises.readFile(dotGitPath, 'utf8');
    const gitDirectoryPointerMatch =
      GIT_DIRECTORY_POINTER_LINE_PATTERN.exec(dotGitFileContent);
    if (gitDirectoryPointerMatch === null) {
      throw new Error(`${dotGitPath} carries no gitdir pointer`);
    }
    return path.resolve(
      workingDirectoryPath,
      gitDirectoryPointerMatch[1].trim(),
    );
  };
}
