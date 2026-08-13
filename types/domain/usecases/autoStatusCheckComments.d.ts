export declare const AUTO_STATUS_CHECK_MESSAGE_HEAD = "Auto Status Check:";
export declare const dropTrailingAutoStatusCheckComments: <T extends {
    author: string;
    content: string;
}>(comments: T[], isTrustedAuthor: (author: string) => boolean) => T[];
//# sourceMappingURL=autoStatusCheckComments.d.ts.map