import { OwnerCall } from '../../../domain/usecases/intmux/OwnerCallFile';
export type OwnerCallFileAppendParams = {
    dataDir: string;
    projectCode: string | null;
    ownerCall: OwnerCall;
};
export type OwnerCallFileDeleteParams = {
    dataDir: string;
    projectCode: string | null;
    sessionName: string;
};
export type OwnerCallFileDeleteInEveryProjectParams = {
    dataDir: string;
    sessionName: string;
};
export declare const ownerCallFilePath: (dataDir: string, projectCode: string | null, sessionName: string) => string;
export declare const ownerCallFileAppend: (params: OwnerCallFileAppendParams) => void;
export declare const ownerCallFileDelete: (params: OwnerCallFileDeleteParams) => void;
export declare const ownerCallFileDeleteInEveryProject: (params: OwnerCallFileDeleteInEveryProjectParams) => void;
export declare const ownerCallProjectCodeInInTmuxByHumanData: (dataDir: string, sessionName: string) => string | null;
//# sourceMappingURL=ownerCallFileStore.d.ts.map