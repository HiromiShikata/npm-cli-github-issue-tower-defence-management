"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchProxiedImage = exports.isAllowedImageUrl = void 0;
const ALLOWED_IMAGE_URL = new RegExp('^https://github\\.com/user-attachments/' +
    '|^https://[a-z0-9][a-z0-9.-]*\\.githubusercontent\\.com/');
const isAllowedImageUrl = (url) => ALLOWED_IMAGE_URL.test(url);
exports.isAllowedImageUrl = isAllowedImageUrl;
const defaultImageFetcher = async (url, headers) => {
    const response = await fetch(url, { headers, redirect: 'follow' });
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
    if (!(0, exports.isAllowedImageUrl)(url)) {
        return { ok: false, statusCode: 400, error: 'url not in allowed domain' };
    }
    let result;
    try {
        result = await fetcher(url, {
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