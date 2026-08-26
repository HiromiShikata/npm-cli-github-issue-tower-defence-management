import { Project } from "../../../domain/entities/Project";
import {
	ConsolePjcodeValidator,
	ConsoleProjectBinding,
	ConsoleProjectResolver,
} from "./consoleOperationApi";

export type ConsoleProjectLoader = (
	projectUrl: string,
) => Promise<Project | null>;

export type ConsoleProjectIdAndProjectReader = {
	findProjectIdByUrl: (projectUrl: string) => Promise<string | null>;
	getProject: (projectId: string) => Promise<Project | null>;
};

export const createConsoleProjectLoader = (
	resolveProjectRepository: (
		projectUrl: string,
	) => ConsoleProjectIdAndProjectReader,
	getCachedProject: (projectId: string) => Promise<Project | null>,
	reportLoadFailure: (message: string) => void,
): ConsoleProjectLoader => {
	return async (projectUrl: string): Promise<Project | null> => {
		const projectRepository = resolveProjectRepository(projectUrl);
		const projectId = await projectRepository.findProjectIdByUrl(projectUrl);
		if (!projectId) {
			reportLoadFailure(`No project found for projectUrl ${projectUrl}`);
			return null;
		}
		const cachedProject = await getCachedProject(projectId);
		if (cachedProject) {
			return cachedProject;
		}
		const loadedProject = await projectRepository.getProject(projectId);
		if (!loadedProject) {
			reportLoadFailure(`Failed to load project for projectUrl ${projectUrl}`);
			return null;
		}
		return loadedProject;
	};
};

export const buildPjcodeToProjectUrl = (
	defaultPjcode: string,
	defaultProjectUrl: string,
	consoleProjects: Record<string, string> | null,
): Record<string, string> => {
	const mapping: Record<string, string> = {};
	if (consoleProjects !== null) {
		for (const [pjcode, projectUrl] of Object.entries(consoleProjects)) {
			mapping[pjcode] = projectUrl;
		}
	}
	if (!(defaultPjcode in mapping)) {
		mapping[defaultPjcode] = defaultProjectUrl;
	}
	return mapping;
};

// Builds a synchronous predicate that reports whether a pjcode is configured,
// using only the local pjcode-to-project-url mapping. This lets close
// operations validate the pjcode without loading the ProjectV2 via GraphQL.
export const createPjcodeConfigChecker = (
	pjcodeToProjectUrl: Record<string, string>,
): ConsolePjcodeValidator => {
	return (pjcode: string): boolean =>
		Object.prototype.hasOwnProperty.call(pjcodeToProjectUrl, pjcode);
};

export type ConsoleProjectResolverBundle = {
	resolve: ConsoleProjectResolver;
	invalidate: (pjcode: string) => void;
};

export const createConsoleProjectResolver = (
	pjcodeToProjectUrl: Record<string, string>,
	loadProject: ConsoleProjectLoader,
): ConsoleProjectResolverBundle => {
	const cache = new Map<string, ConsoleProjectBinding>();
	const resolve: ConsoleProjectResolver = async (
		pjcode: string,
	): Promise<ConsoleProjectBinding | null> => {
		const cached = cache.get(pjcode);
		if (cached !== undefined) {
			return cached;
		}
		const projectUrl = pjcodeToProjectUrl[pjcode];
		if (projectUrl === undefined) {
			return null;
		}
		const project = await loadProject(projectUrl);
		if (project === null) {
			return null;
		}
		const binding: ConsoleProjectBinding = { pjcode, project };
		cache.set(pjcode, binding);
		return binding;
	};
	const invalidate = (pjcode: string): void => {
		cache.delete(pjcode);
	};
	return { resolve, invalidate };
};
