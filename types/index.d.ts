export declare const hello: (name: string) => string;
export { Project } from './domain/entities/Project';
export { Issue } from './domain/entities/Issue';
export declare const scheduledEvent: (configFilePath: string) => Promise<{
  project: import('./domain/entities/Project').Project;
  issues: import('./domain/entities/Issue').Issue[];
  cacheUsed: boolean;
  targetDateTimes: Date[];
}>;
//# sourceMappingURL=index.d.ts.map
