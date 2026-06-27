import { InteractiveLiveSession } from '../../domain/entities/InteractiveLiveSession';
import { InteractiveLiveSessionTranscriptResolver } from '../../domain/usecases/adapter-interfaces/InteractiveLiveSessionTranscriptResolver';
/**
 * Resolves the real transcript path of an interactive Claude Code session from
 * the session id and config directory taken from the session's process
 * environment. The transcript lives at
 * `<configDir>/projects/<cwd-slug>/<sessionId>.jsonl`; this resolver scans the
 * `projects` subdirectories for a file named `<sessionId>.jsonl` and returns the
 * most recently modified match. Because resolution is keyed on the process
 * session id rather than on a session name or issue URL, a plain-named session
 * (for example one named `workbench`) resolves just as well as an issue-url
 * named one.
 */
export declare class FileSystemInteractiveLiveSessionTranscriptResolver implements InteractiveLiveSessionTranscriptResolver {
    resolveTranscriptPaths: (sessions: InteractiveLiveSession[]) => Map<string, string>;
    private resolveTranscriptPath;
}
//# sourceMappingURL=FileSystemInteractiveLiveSessionTranscriptResolver.d.ts.map