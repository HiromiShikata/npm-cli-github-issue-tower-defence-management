export declare class LocalStorageRepository {
    write: (path: string, value: string) => void;
    read: (path: string) => string | null;
    rename: (oldPath: string, newPath: string) => void;
    listFiles: (dirPath: string) => string[];
    mkdir: (dirPath: string) => void;
    remove: (path: string) => void;
}
//# sourceMappingURL=LocalStorageRepository.d.ts.map