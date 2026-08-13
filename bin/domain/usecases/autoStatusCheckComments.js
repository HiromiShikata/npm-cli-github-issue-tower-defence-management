"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dropTrailingAutoStatusCheckComments = exports.AUTO_STATUS_CHECK_MESSAGE_HEAD = void 0;
exports.AUTO_STATUS_CHECK_MESSAGE_HEAD = 'Auto Status Check:';
const dropTrailingAutoStatusCheckComments = (comments, isTrustedAuthor) => {
    let endIndex = comments.length;
    while (endIndex > 0 &&
        isTrustedAuthor(comments[endIndex - 1].author) &&
        comments[endIndex - 1].content.startsWith(exports.AUTO_STATUS_CHECK_MESSAGE_HEAD)) {
        endIndex -= 1;
    }
    return comments.slice(0, endIndex);
};
exports.dropTrailingAutoStatusCheckComments = dropTrailingAutoStatusCheckComments;
//# sourceMappingURL=autoStatusCheckComments.js.map