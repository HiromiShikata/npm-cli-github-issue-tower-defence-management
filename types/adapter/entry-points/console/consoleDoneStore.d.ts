export declare const CONSOLE_DONE_FILE_NAME = ".done.json";
export type ConsoleDoneRecord = {
    projectItemIds: string[];
};
export declare const doneFilePathForTab: (consoleDataOutputDir: string, pjcode: string, tab: string) => string;
export declare const readDoneProjectItemIds: (consoleDataOutputDir: string, pjcode: string, tab: string) => string[];
export declare const recordDoneProjectItemId: (consoleDataOutputDir: string, pjcode: string, tab: string, projectItemId: string) => void;
export declare const CONSOLE_DONE_TAB_NAMES: string[];
export declare const recordDoneProjectItemIdAcrossTabs: (consoleDataOutputDir: string, pjcode: string, projectItemId: string) => void;
export declare const resetDoneProjectItemIds: (consoleDataOutputDir: string, pjcode: string, tab: string) => void;
export declare const resetDoneProjectItemIdsAcrossTabs: (consoleDataOutputDir: string, pjcode: string) => void;
//# sourceMappingURL=consoleDoneStore.d.ts.map