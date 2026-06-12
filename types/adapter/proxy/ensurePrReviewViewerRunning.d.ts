export declare const PR_REVIEW_VIEWER_DEFAULT_PORT = 3737;
export interface ViewerProcess {
    kill: () => void;
}
export declare const ensurePrReviewViewerRunning: (accessKey: string, port?: number) => Promise<ViewerProcess | null>;
//# sourceMappingURL=ensurePrReviewViewerRunning.d.ts.map