"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeForURI = void 0;
const encodeForURI = (url) => {
    if (!url) {
        return '';
    }
    return encodeURI(url).replace(/#/g, '%23').replace(/&/g, '%26');
};
exports.encodeForURI = encodeForURI;
//# sourceMappingURL=utils.js.map