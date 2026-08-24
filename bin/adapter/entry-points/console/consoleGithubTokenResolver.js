"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConsoleGithubTokenResolver = exports.createConsoleGithubTokenResolverByItemUrl = exports.createConsoleProjectRepositoryResolver = exports.extractProjectOwner = exports.createConsoleIssueRepositoryResolver = exports.extractRepositoryOwner = void 0;
const extractRepositoryOwner = (issueOrPullRequestUrl) => {
    const match = issueOrPullRequestUrl.match(/^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/[A-Za-z0-9._-]+\/(?:issues|pull)\/\d+/);
    return match ? match[1] : null;
};
exports.extractRepositoryOwner = extractRepositoryOwner;
const createConsoleIssueRepositoryResolver = (resolveGithubToken, buildIssueRepositoryForToken) => {
    return (issueOrPullRequestUrl) => {
        const repositoryOwner = (0, exports.extractRepositoryOwner)(issueOrPullRequestUrl);
        if (repositoryOwner === null) {
            throw new Error(`The repository owner cannot be read from the operated url: ${issueOrPullRequestUrl}`);
        }
        return buildIssueRepositoryForToken(resolveGithubToken(repositoryOwner));
    };
};
exports.createConsoleIssueRepositoryResolver = createConsoleIssueRepositoryResolver;
const extractProjectOwner = (projectUrl) => {
    const match = projectUrl.match(/^https:\/\/github\.com\/(?:orgs|users)\/([A-Za-z0-9._-]+)\/projects\/\d+/);
    return match ? match[1] : null;
};
exports.extractProjectOwner = extractProjectOwner;
const createConsoleProjectRepositoryResolver = (resolveGithubToken, buildProjectRepositoryForToken) => {
    return (projectUrl) => {
        const projectOwner = (0, exports.extractProjectOwner)(projectUrl);
        if (projectOwner === null) {
            throw new Error(`The project owner cannot be read from the project url: ${projectUrl}`);
        }
        return buildProjectRepositoryForToken(resolveGithubToken(projectOwner));
    };
};
exports.createConsoleProjectRepositoryResolver = createConsoleProjectRepositoryResolver;
const createConsoleGithubTokenResolverByItemUrl = (resolveGithubToken) => {
    return (itemUrl) => {
        const owner = (0, exports.extractRepositoryOwner)(itemUrl);
        if (owner === null) {
            throw new Error(`The repository owner cannot be read from the url: ${itemUrl}`);
        }
        return resolveGithubToken(owner);
    };
};
exports.createConsoleGithubTokenResolverByItemUrl = createConsoleGithubTokenResolverByItemUrl;
const createConsoleGithubTokenResolver = (defaultToken, githubTokenFilePathByRepositoryOwner, readTokenFile) => {
    const resolvedTokenByRepositoryOwner = new Map();
    return (repositoryOwner) => {
        const alreadyResolved = resolvedTokenByRepositoryOwner.get(repositoryOwner);
        if (alreadyResolved !== undefined) {
            return alreadyResolved;
        }
        if (githubTokenFilePathByRepositoryOwner === null) {
            return defaultToken;
        }
        const filePath = githubTokenFilePathByRepositoryOwner[repositoryOwner];
        if (filePath === undefined) {
            return defaultToken;
        }
        const token = readTokenFile(filePath).trim();
        if (token.length === 0) {
            throw new Error(`The GitHub token file configured for repository owner "${repositoryOwner}" contains no token: ${filePath}`);
        }
        resolvedTokenByRepositoryOwner.set(repositoryOwner, token);
        return token;
    };
};
exports.createConsoleGithubTokenResolver = createConsoleGithubTokenResolver;
//# sourceMappingURL=consoleGithubTokenResolver.js.map