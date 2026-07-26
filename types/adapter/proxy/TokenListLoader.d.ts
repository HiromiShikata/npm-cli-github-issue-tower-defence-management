export type TokenEntry = {
    name: string;
    token: string;
    selectionWeight?: number;
};
export declare const loadTokenEntries: (jsonPath: string) => TokenEntry[] | null;
export declare const loadTokens: (jsonPath: string) => string[] | null;
//# sourceMappingURL=TokenListLoader.d.ts.map