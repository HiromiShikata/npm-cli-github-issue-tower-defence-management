export declare const OWNER_CALL_FILE_DIRECTORY_NAME = "call-to-user";
export declare const OWNER_CALL_FILE_PROJECT_CODE_FOR_NO_PROJECT = "NA";
export declare const OWNER_CALL_FILE_EXTENSION = ".yaml";
export type OwnerCall = {
    sessionName: string;
    calledAt: string;
    body: string;
};
export declare const ownerCallFileSessionKey: (sessionName: string) => string;
export declare const ownerCallFileRelativePath: (projectCode: string | null, sessionName: string) => string;
export type OwnerCallProjectSessionNames = {
    projectCode: string;
    sessionNames: string[];
};
export declare const ownerCallProjectCodeOfSession: (projects: OwnerCallProjectSessionNames[], sessionName: string) => string | null;
export declare const isOwnerCallCalledAtValid: (calledAt: string) => boolean;
export declare const ownerCallYamlDocument: (ownerCall: OwnerCall) => string;
//# sourceMappingURL=OwnerCallFile.d.ts.map