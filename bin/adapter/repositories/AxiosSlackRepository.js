"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AxiosSlackRepository = void 0;
const axios_1 = __importStar(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const fs_1 = __importDefault(require("fs"));
const getRetryAfterDelay = (error) => {
    const headers = error.response?.headers;
    if (!headers) {
        return null;
    }
    if (headers instanceof axios_1.AxiosHeaders) {
        const retryAfter = headers.get('retry-after');
        if (typeof retryAfter === 'string') {
            const parsed = parseInt(retryAfter, 10);
            if (!isNaN(parsed)) {
                return parsed * 1000;
            }
        }
    }
    return null;
};
class AxiosSlackRepository {
    constructor(userToken) {
        this.baseUrl = 'https://slack.com/api';
        if (!userToken.startsWith('xoxp-')) {
            throw new Error('Invalid user token. It should start with xoxp-');
        }
        this.client = axios_1.default.create({
            baseURL: this.baseUrl,
            headers: {
                Authorization: `Bearer ${userToken}`,
            },
        });
        (0, axios_retry_1.default)(this.client, {
            retries: 3,
            retryDelay: (retryCount, error) => {
                const retryAfterDelay = getRetryAfterDelay(error);
                if (retryAfterDelay !== null) {
                    return retryAfterDelay;
                }
                return axios_retry_1.default.exponentialDelay(retryCount);
            },
            retryCondition: (error) => {
                return (axios_retry_1.default.isNetworkOrIdempotentRequestError(error) ||
                    error.response?.status === 429);
            },
        });
    }
    async postMessageToChannel(message, channelName) {
        const { data } = await this.client.get('/conversations.list');
        const channel = data.channels.find((c) => c.name === channelName);
        if (!channel)
            throw new Error(`Channel ${channelName} not found`);
        const res = await this.client.post('/chat.postMessage', {
            channel: channel.id,
            text: message,
        });
        if (!res.data.ok) {
            throw new Error(`Failed to post message: ${JSON.stringify(res.data)}`);
        }
        return {
            threadTs: res.data.ts,
        };
    }
    async postMessageToChannelThread(message, channelName, threadTs) {
        const { data } = await this.client.get('/conversations.list');
        const channel = data.channels.find((c) => c.name === channelName);
        if (!channel)
            throw new Error(`Channel ${channelName} not found`);
        const res = await this.client.post('/chat.postMessage', {
            channel: channel.id,
            text: message,
            thread_ts: threadTs,
        });
        if (!res.data.ok) {
            throw new Error(`Failed to post message: ${JSON.stringify(res.data)}`);
        }
    }
    async postMessageToDirectMessage(message, userName) {
        const { data } = await this.client.get('/users.list');
        const user = data.members.find((u) => u.name === userName);
        if (!user)
            throw new Error(`User ${userName} not found`);
        const res = await this.client.post('/chat.postMessage', {
            channel: user.id,
            text: message,
        });
        if (!res.data.ok) {
            throw new Error(`Failed to post message: ${JSON.stringify(res.data)}`);
        }
    }
    async postMessageToChannelWithImage(message, channelName, imageFilePath) {
        const { data } = await this.client.get('/conversations.list');
        const channel = data.channels.find((c) => c.name === channelName);
        if (!channel)
            throw new Error(`Channel ${channelName} not found`);
        const fileStats = fs_1.default.statSync(imageFilePath);
        const fileName = imageFilePath.split('/').pop();
        const uploadUrlRes = await this.client.post('/files.getUploadURLExternal', {
            filename: fileName,
            length: fileStats.size,
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
            },
        });
        if (!uploadUrlRes.data.ok) {
            throw new Error(`Failed to get upload URL: ${JSON.stringify(uploadUrlRes.data)}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const fileContent = fs_1.default.readFileSync(imageFilePath);
        await axios_1.default.post(uploadUrlRes.data.upload_url, fileContent, {
            headers: {
                'Content-Type': 'application/octet-stream',
            },
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const completeRes = await this.client.post('/files.completeUploadExternal', {
            files: [
                {
                    id: uploadUrlRes.data.file_id,
                },
            ],
        });
        if (!completeRes.data.ok) {
            throw new Error(`Failed to complete upload: ${JSON.stringify(completeRes.data)}`);
        }
        const fileInfo = await this.client.get(`/files.info?file=${uploadUrlRes.data.file_id}`);
        if (!fileInfo.data.ok) {
            throw new Error(`Failed to get file info: ${JSON.stringify(fileInfo.data)}`);
        }
        const imageUrl = fileInfo.data.file.url_private;
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const res = await this.client.post('/chat.postMessage', {
            channel: channel.id,
            text: message,
            blocks: [
                {
                    type: 'image',
                    image_url: imageUrl,
                    alt_text: fileName,
                },
            ],
        });
        if (!res.data.ok) {
            throw new Error(`Failed to post message: ${JSON.stringify(res.data)}`);
        }
    }
}
exports.AxiosSlackRepository = AxiosSlackRepository;
//# sourceMappingURL=AxiosSlackRepository.js.map