"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledEvent = exports.hello = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const HandleScheduledEventUseCaseHandler_1 = require("./adapter/entry-points/handlers/HandleScheduledEventUseCaseHandler");
dotenv_1.default.config();
const hello = (name) => `hello ${name}`;
exports.hello = hello;
exports.scheduledEvent = new HandleScheduledEventUseCaseHandler_1.HandleScheduledEventUseCaseHandler().handle;
//# sourceMappingURL=index.js.map