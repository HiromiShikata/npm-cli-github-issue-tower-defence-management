"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchProxiedImage = exports.isAllowedImageUrl = void 0;
const GITHUBUSERCONTENT_HOST_SUFFIX = '.githubusercontent.com';
const isAllowedHost = (hostname) => {
    if (hostname === 'github.com') {
        return true;
    }
    if (!hostname.endsWith(GITHUBUSERCONTENT_HOST_SUFFIX)) {
        return false;
    }
    const subdomain = hostname.slice(0, hostname.length - GITHUBUSERCONTENT_HOST_SUFFIX.length);
    return subdomain.length > 0 && /^[a-z0-9][a-z0-9.-]*$/.test(subdomain);
};
const parseAllowedImageUrl = (url) => {
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        return null;
    }
    if (parsed.protocol !== 'https:') {
        return null;
    }
    if (parsed.hostname === 'github.com') {
        return parsed.pathname.startsWith('/user-attachments/') ? parsed : null;
    }
    return isAllowedHost(parsed.hostname) ? parsed : null;
};
const isAllowedImageUrl = (url) => parseAllowedImageUrl(url) !== null;
exports.isAllowedImageUrl = isAllowedImageUrl;
const defaultImageFetcher = async (url, headers) => {
    const validated = parseAllowedImageUrl(url);
    if (validated === null) {
        throw new Error('url not in allowed domain');
    }
    const safeUrl = `https://${validated.host}${validated.pathname}${validated.search}`;
    const response = await fetch(safeUrl, { headers, redirect: 'follow' });
    const arrayBuffer = await response.arrayBuffer();
    return {
        status: response.status,
        contentType: response.headers.get('content-type'),
        body: Buffer.from(arrayBuffer),
    };
};
const fetchProxiedImage = async (url, githubToken, fetcher = defaultImageFetcher) => {
    if (url.length === 0) {
        return { ok: false, statusCode: 400, error: 'missing url parameter' };
    }
    const allowedUrl = parseAllowedImageUrl(url);
    if (allowedUrl === null) {
        return { ok: false, statusCode: 400, error: 'url not in allowed domain' };
    }
    let result;
    try {
        result = await fetcher(allowedUrl.toString(), {
            Authorization: `token ${githubToken}`,
        });
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return { ok: false, statusCode: 502, error: `proxy error: ${detail}` };
    }
    if (result.status < 200 || result.status >= 300) {
        return {
            ok: false,
            statusCode: 502,
            error: `upstream ${result.status}`,
        };
    }
    return {
        ok: true,
        contentType: result.contentType ?? 'application/octet-stream',
        body: result.body,
    };
};
exports.fetchProxiedImage = fetchProxiedImage;
//# sourceMappingURL=consoleImageProxy.js.map