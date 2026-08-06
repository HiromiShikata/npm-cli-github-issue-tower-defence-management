import { Project } from '../../../domain/entities/Project';
import { ConsolePjcodeValidator, ConsoleProjectResolver } from './consoleOperationApi';
export type ConsoleProjectLoader = (projectUrl: string) => Promise<Project | null>;
export type ConsoleProjectIdAndProjectReader = {
    findProjectIdByUrl: (projectUrl: string) => Promise<string | null>;
    getProject: (projectId: string) => Promise<Project | null>;
};
export declare const createConsoleProjectLoader: (resolveProjectRepository: (projectUrl: string) => ConsoleProjectIdAndProjectReader, getCachedProject: (projectId: string) => Promise<Project | null>, reportLoadFailure: (message: string) => void) => ConsoleProjectLoader;
export declare const buildPjcodeToProjectUrl: (defaultPjcode: string, defaultProjectUrl: string, consoleProjects: Record<string, string> | null) => Record<string, string>;
export declare const createPjcodeConfigChecker: (pjcodeToProjectUrl: Record<string, string>) => ConsolePjcodeValidator;
export declare const createConsoleProjectResolver: (pjcodeToProjectUrl: Record<string, string>, loadProject: ConsoleProjectLoader) => ConsoleProjectResolver;
//# sourceMappingURL=consoleProjectResolver.d.ts.map