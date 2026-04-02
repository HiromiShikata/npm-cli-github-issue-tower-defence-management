"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KySlackRepository = void 0;
const ky_1 = __importDefault(require("ky"));
const fs_1 = __importDefault(require("fs"));
const isRecord = (data) => {
    return typeof data === 'object' && data !== null;
};
const isConversationsListResponse = (data) => {
    return (isRecord(data) &&
        typeof data['ok'] === 'boolean' &&
        Array.isArray(data['channels']));
};
const isUsersListResponse = (data) => {
    return (isRecord(data) &&
        typeof data['ok'] === 'boolean' &&
        Array.isArray(data['members']));
};
const isPostMessageResponse = (data) => {
    return isRecord(data) && typeof data['ok'] === 'boolean';
};
const isUploadUrlResponse = (data) => {
    return (isRecord(data) &&
        typeof data['ok'] === 'boolean' &&
        'upload_url' in data &&
        'file_id' in data);
};
const isCompleteUploadResponse = (data) => {
    return isRecord(data) && typeof data['ok'] === 'boolean';
};
const isFileInfoResponse = (data) => {
    return isRecord(data) && typeof data['ok'] === 'boolean' && 'file' in data;
};
class KySlackRepository {
    constructor(userToken) {
        this.baseUrl = 'https://slack.com/api';
        if (!userToken.startsWith('xoxp-')) {
            throw new Error('Invalid user token. It should start with xoxp-');
        }
        this.authHeader = `Bearer ${userToken}`;
        this.client = ky_1.default.extend({
            retry: {
                limit: 3,
                methods: ['get', 'post'],
                statusCodes: [429, 500, 502, 503, 504],
            },
        });
    }
    async postMessageToChannel(message, channelName) {
        const data = await this.client
            .get(`${this.baseUrl}/conversations.list`, {
            headers: { Authorization: this.authHeader },
        })
            .json();
        if (!isConversationsListResponse(data)) {
            throw new Error(`Invalid response: ${JSON.stringify(data)}`);
        }
        const channel = data.channels.find((c) => c.name === channelName);
        if (!channel)
            throw new Error(`Channel ${channelName} not found`);
        const res = await this.client
            .post(`${this.baseUrl}/chat.postMessage`, {
            json: { channel: channel.id, text: message },
            headers: { Authorization: this.authHeader },
        })
            .json();
        if (!isPostMessageResponse(res)) {
            throw new Error(`Invalid response: ${JSON.stringify(res)}`);
        }
        if (!res.ok) {
            throw new Error(`Failed to post message: ${JSON.stringify(res)}`);
        }
        return { threadTs: res.ts };
    }
    async postMessageToChannelThread(message, channelName, threadTs) {
        const data = await this.client
            .get(`${this.baseUrl}/conversations.list`, {
            headers: { Authorization: this.authHeader },
        })
            .json();
        if (!isConversationsListResponse(data)) {
            throw new Error(`Invalid response: ${JSON.stringify(data)}`);
        }
        const channel = data.channels.find((c) => c.name === channelName);
        if (!channel)
            throw new Error(`Channel ${channelName} not found`);
        const res = await this.client
            .post(`${this.baseUrl}/chat.postMessage`, {
            json: { channel: channel.id, text: message, thread_ts: threadTs },
            headers: { Authorization: this.authHeader },
        })
            .json();
        if (!isPostMessageResponse(res)) {
            throw new Error(`Invalid response: ${JSON.stringify(res)}`);
        }
        if (!res.ok) {
            throw new Error(`Failed to post message: ${JSON.stringify(res)}`);
        }
    }
    async postMessageToDirectMessage(message, userName) {
        const data = await this.client
            .get(`${this.baseUrl}/users.list`, {
            headers: { Authorization: this.authHeader },
        })
            .json();
        if (!isUsersListResponse(data)) {
            throw new Error(`Invalid response: ${JSON.stringify(data)}`);
        }
        const user = data.members.find((u) => u.name === userName);
        if (!user)
            throw new Error(`User ${userName} not found`);
        const res = await this.client
            .post(`${this.baseUrl}/chat.postMessage`, {
            json: { channel: user.id, text: message },
            headers: { Authorization: this.authHeader },
        })
            .json();
        if (!isPostMessageResponse(res)) {
            throw new Error(`Invalid response: ${JSON.stringify(res)}`);
        }
        if (!res.ok) {
            throw new Error(`Failed to post message: ${JSON.stringify(res)}`);
        }
    }
    async postMessageToChannelWithImage(message, channelName, imageFilePath) {
        const data = await this.client
            .get(`${this.baseUrl}/conversations.list`, {
            headers: { Authorization: this.authHeader },
        })
            .json();
        if (!isConversationsListResponse(data)) {
            throw new Error(`Invalid response: ${JSON.stringify(data)}`);
        }
        const channel = data.channels.find((c) => c.name === channelName);
        if (!channel)
            throw new Error(`Channel ${channelName} not found`);
        const fileStats = fs_1.default.statSync(imageFilePath);
        const fileName = imageFilePath.split('/').pop();
        const formBody = new URLSearchParams({
            filename: fileName ?? '',
            length: String(fileStats.size),
        });
        const uploadUrlRes = await this.client
            .post(`${this.baseUrl}/files.getUploadURLExternal`, {
            body: formBody,
            headers: {
                Authorization: this.authHeader,
                'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
            },
        })
            .json();
        if (!isUploadUrlResponse(uploadUrlRes)) {
            throw new Error(`Invalid response: ${JSON.stringify(uploadUrlRes)}`);
        }
        if (!uploadUrlRes.ok) {
            throw new Error(`Failed to get upload URL: ${JSON.stringify(uploadUrlRes)}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const fileContent = fs_1.default.readFileSync(imageFilePath);
        await ky_1.default.post(uploadUrlRes.upload_url, {
            body: new Uint8Array(fileContent),
            headers: { 'Content-Type': 'application/octet-stream' },
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const completeRes = await this.client
            .post(`${this.baseUrl}/files.completeUploadExternal`, {
            json: { files: [{ id: uploadUrlRes.file_id }] },
            headers: { Authorization: this.authHeader },
        })
            .json();
        if (!isCompleteUploadResponse(completeRes)) {
            throw new Error(`Invalid response: ${JSON.stringify(completeRes)}`);
        }
        if (!completeRes.ok) {
            throw new Error(`Failed to complete upload: ${JSON.stringify(completeRes)}`);
        }
        const fileInfo = await this.client
            .get(`${this.baseUrl}/files.info?file=${uploadUrlRes.file_id}`, {
            headers: { Authorization: this.authHeader },
        })
            .json();
        if (!isFileInfoResponse(fileInfo)) {
            throw new Error(`Invalid response: ${JSON.stringify(fileInfo)}`);
        }
        if (!fileInfo.ok) {
            throw new Error(`Failed to get file info: ${JSON.stringify(fileInfo)}`);
        }
        const imageUrl = fileInfo.file.url_private;
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const res = await this.client
            .post(`${this.baseUrl}/chat.postMessage`, {
            json: {
                channel: channel.id,
                text: message,
                blocks: [{ type: 'image', image_url: imageUrl, alt_text: fileName }],
            },
            headers: { Authorization: this.authHeader },
        })
            .json();
        if (!isPostMessageResponse(res)) {
            throw new Error(`Invalid response: ${JSON.stringify(res)}`);
        }
        if (!res.ok) {
            throw new Error(`Failed to post message: ${JSON.stringify(res)}`);
        }
    }
}
exports.KySlackRepository = KySlackRepository;
//# sourceMappingURL=KySlackRepository.js.map