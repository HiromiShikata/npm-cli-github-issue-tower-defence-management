import { Issue } from '../../entities/Issue';
import { Comment } from '../../entities/Comment';

export interface IssueCommentRepository {
  getCommentsFromIssue(issue: Issue): Promise<Comment[]>;
  createComment(issue: Issue, commentContent: string): Promise<void>;
  updateComment(
    issue: Issue,
    commentId: string,
    commentContent: string,
  ): Promise<void>;
}
