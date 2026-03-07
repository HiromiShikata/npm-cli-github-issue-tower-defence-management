"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeForURI = void 0;
const encodeForURI = (url) => {
    if (!url) {
        return '';
    }
    return encodeURI(url).replace('#', '%23').replace('&', '%26');
};
exports.encodeForURI = encodeForURI;
//# sourceMappingURL=utils.js.map