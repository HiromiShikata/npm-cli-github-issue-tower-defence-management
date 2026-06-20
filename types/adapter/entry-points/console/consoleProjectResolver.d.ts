import { Project } from '../../../domain/entities/Project';
import { ConsoleProjectResolver } from './consoleOperationApi';
export type ConsoleProjectLoader = (projectUrl: string) => Promise<Project | null>;
export declare const buildPjcodeToProjectUrl: (defaultPjcode: string, defaultProjectUrl: string, consoleProjects: Record<string, string> | null) => Record<string, string>;
export declare const createConsoleProjectResolver: (pjcodeToProjectUrl: Record<string, string>, loadProject: ConsoleProjectLoader) => ConsoleProjectResolver;
//# sourceMappingURL=consoleProjectResolver.d.ts.map