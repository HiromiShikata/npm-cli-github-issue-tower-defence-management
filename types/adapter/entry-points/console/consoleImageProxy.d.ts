export declare const isAllowedImageUrl: (url: string) => boolean;
export type ProxiedImageSuccess = {
    ok: true;
    contentType: string;
    body: Buffer;
};
export type ProxiedImageFailure = {
    ok: false;
    statusCode: number;
    error: string;
};
export type ProxiedImageResult = ProxiedImageSuccess | ProxiedImageFailure;
export type ImageFetcher = (url: string, headers: Record<string, string>) => Promise<{
    status: number;
    contentType: string | null;
    body: Buffer;
}>;
export declare const fetchProxiedImage: (url: string, githubToken: string, fetcher?: ImageFetcher) => Promise<ProxiedImageResult>;
//# sourceMappingURL=consoleImageProxy.d.ts.map