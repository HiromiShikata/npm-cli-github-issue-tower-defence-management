interface Cookie {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'lax' | 'strict' | 'none';
}
export declare class BaseGitHubRepository {
    readonly jsonFilePath: string;
    readonly ghToken: string;
    readonly ghUserName: string | undefined;
    readonly ghUserPassword: string | undefined;
    readonly ghAuthenticatorKey: string | undefined;
    cookie: string | null;
    constructor(jsonFilePath?: string, ghToken?: string, ghUserName?: string | undefined, ghUserPassword?: string | undefined, ghAuthenticatorKey?: string | undefined);
    protected extractIssueFromUrl: (issueUrl: string) => {
        owner: string;
        repo: string;
        issueNumber: number;
        isIssue: boolean;
    };
    getCookie: () => Promise<string>;
    createHeader: () => Promise<object>;
    protected createCookieStringFromFile: () => Promise<string>;
    protected isCookie: (cookie: object) => cookie is Cookie;
    protected generateCookieHeaderFromJson: (cookieData: unknown) => Promise<string>;
}
export {};
//# sourceMappingURL=BaseGitHubRepository.d.ts.map