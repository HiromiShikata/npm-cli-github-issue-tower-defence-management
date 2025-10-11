"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseGitHubRepository = void 0;
const fs_1 = require("fs");
const cookie_1 = require("cookie");
const gh_cookie_1 = require("gh-cookie");
const fs_2 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
class BaseGitHubRepository {
    constructor(localStorageRepository, jsonFilePath = './tmp/github.com.cookies.json', ghToken = process.env.GH_TOKEN || 'dummy', ghUserName = process.env.GH_USER_NAME, ghUserPassword = process.env.GH_USER_PASSWORD, ghAuthenticatorKey = process.env
        .GH_AUTHENTICATOR_KEY) {
        this.localStorageRepository = localStorageRepository;
        this.jsonFilePath = jsonFilePath;
        this.ghToken = ghToken;
        this.ghUserName = ghUserName;
        this.ghUserPassword = ghUserPassword;
        this.ghAuthenticatorKey = ghAuthenticatorKey;
        this.extractIssueFromUrl = (issueUrl) => {
            const match = issueUrl.match(/https:\/\/github.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
            if (!match) {
                throw new Error(`Invalid issue URL: ${issueUrl}`);
            }
            const [, owner, repo, pullOrIssue, issueNumberStr] = match;
            const issueNumber = parseInt(issueNumberStr, 10);
            if (isNaN(issueNumber)) {
                throw new Error(`Invalid issue number: ${issueNumberStr}. URL: ${issueUrl}`);
            }
            return { owner, repo, issueNumber, isIssue: pullOrIssue === 'issues' };
        };
        this.getCookie = async () => {
            if (!this.cookie) {
                this.cookie = await this.createCookieStringFromFile();
            }
            return this.cookie;
        };
        this.createHeader = async () => {
            const cookie = await this.getCookie();
            const headers = {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'en-US,en;q=0.9,es-MX;q=0.8,es;q=0.7,ja-JP;q=0.6,ja;q=0.5',
                'cache-control': 'max-age=0',
                'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Linux"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                Referer: 'https://github.com/orgs/community/discussions/30979',
                'Referrer-Policy': 'no-referrer-when-downgrade',
            };
            return {
                ...headers,
                cookie: cookie,
            };
        };
        this.createCookieStringFromFile = async () => {
            if (!fs_2.default.existsSync(this.jsonFilePath)) {
                if (!this.ghUserName ||
                    !this.ghUserPassword ||
                    !this.ghAuthenticatorKey) {
                    throw new Error('No cookie file and no credentials provided');
                }
                const cookie = await (0, gh_cookie_1.getCookieContent)(this.ghUserName, this.ghUserPassword, this.ghAuthenticatorKey);
                this.localStorageRepository.write(this.jsonFilePath, cookie);
            }
            const data = await fs_1.promises.readFile(this.jsonFilePath, {
                encoding: 'utf-8',
            });
            const cookiesData = JSON.parse(data);
            return this.generateCookieHeaderFromJson(cookiesData);
        };
        this.isCookie = (cookie) => {
            return ('name' in cookie &&
                typeof cookie.name === 'string' &&
                'value' in cookie &&
                typeof cookie.value === 'string' &&
                'domain' in cookie &&
                typeof cookie.domain === 'string' &&
                'path' in cookie &&
                typeof cookie.path === 'string' &&
                'expires' in cookie &&
                typeof cookie.expires === 'number' &&
                'httpOnly' in cookie &&
                typeof cookie.httpOnly === 'boolean' &&
                'secure' in cookie &&
                typeof cookie.secure === 'boolean' &&
                'sameSite' in cookie &&
                typeof cookie.sameSite === 'string' &&
                ['lax', 'strict', 'none'].indexOf(cookie.sameSite) !== -1);
        };
        this.generateCookieHeaderFromJson = async (cookieData) => {
            if (!Array.isArray(cookieData)) {
                throw new Error('Invalid cookie array');
            }
            const cookies = cookieData.map((cookieOrig) => {
                const sameSite = typeof cookieOrig !== 'object' ||
                    !('sameSite' in cookieOrig) ||
                    typeof cookieOrig.sameSite !== 'string'
                    ? 'none'
                    : cookieOrig.sameSite.toLowerCase();
                const cookie = {
                    ...cookieOrig,
                    sameSite,
                };
                if (!this.isCookie(cookie)) {
                    throw new Error(`Invalid cookie properties: ${JSON.stringify(cookie)}`);
                }
                return cookie;
            });
            const cookieHeader = cookies
                .map((cookie) => (0, cookie_1.serialize)(cookie.name, cookie.value, {
                domain: cookie.domain,
                path: cookie.path,
                expires: cookie.expires ? new Date(cookie.expires * 1000) : undefined,
                httpOnly: cookie.httpOnly,
                secure: cookie.secure,
                sameSite: cookie.sameSite,
            }))
                .join('; ');
            return cookieHeader;
        };
        this.refreshCookie = async () => {
            if (!this.ghUserName || !this.ghUserPassword || !this.ghAuthenticatorKey) {
                throw new Error('GitHub username, password, and authenticator key must be set');
            }
            const headers = await this.createHeader();
            const content = await axios_1.default.get('https://github.com', { headers });
            const html = content.data;
            if (html.includes(this.ghUserName)) {
                return;
            }
            this.localStorageRepository.remove(this.jsonFilePath);
            const newHeaders = await this.createHeader();
            const newContent = await axios_1.default.get('https://github.com', {
                headers: newHeaders,
            });
            const newHtml = newContent.data;
            if (newHtml.includes(this.ghUserName)) {
                return;
            }
            throw new Error('Failed to refresh cookie');
        };
        this.cookie = null;
    }
}
exports.BaseGitHubRepository = BaseGitHubRepository;
//# sourceMappingURL=BaseGitHubRepository.js.map