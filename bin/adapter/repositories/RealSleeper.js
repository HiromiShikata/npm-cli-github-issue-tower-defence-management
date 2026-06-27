"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealSleeper = void 0;
class RealSleeper {
    constructor() {
        this.sleep = (milliseconds) => {
            if (milliseconds <= 0) {
                return Promise.resolve();
            }
            return new Promise((resolve) => {
                setTimeout(resolve, milliseconds);
            });
        };
    }
}
exports.RealSleeper = RealSleeper;
//# sourceMappingURL=RealSleeper.js.map