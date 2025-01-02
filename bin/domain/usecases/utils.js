"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeForURI = exports.isVisibleIssue = void 0;
const isVisibleIssue = (issue, member, targetDate, disabledStatus) => {
    if ((issue.nextActionDate !== null &&
        issue.nextActionDate.getTime() > targetDate.getTime()) ||
        (issue.nextActionHour !== null &&
            issue.nextActionHour > targetDate.getHours()) ||
        issue.state !== 'OPEN' ||
        !issue.assignees.includes(member) ||
        issue.status === disabledStatus) {
        return false;
    }
    return true;
};
exports.isVisibleIssue = isVisibleIssue;
const encodeForURI = (url) => {
    if (!url) {
        return '';
    }
    return encodeURI(url).replace('#', '%23').replace('&', '%26');
};
exports.encodeForURI = encodeForURI;
//# sourceMappingURL=utils.js.map