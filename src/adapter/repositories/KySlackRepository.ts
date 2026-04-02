import ky from 'ky';
import fs from 'fs';
import { SlackRepository } from '../../domain/usecases/adapter-interfaces/SlackRepository';

type ConversationsListResponse = {
  ok: boolean;
  channels: { id: string; name: string }[];
};
type UsersListResponse = {
  ok: boolean;
  members: { id: string; name: string }[];
};
type PostMessageResponse = {
  ok: boolean;
  ts: string;
};
type UploadUrlResponse = {
  ok: boolean;
  upload_url: string;
  file_id: string;
};
type CompleteUploadResponse = {
  ok: boolean;
};
type FileInfoResponse = {
  ok: boolean;
  file: { url_private: string };
};

const isRecord = (data: unknown): data is Record<string, unknown> => {
  return typeof data === 'object' && data !== null;
};

const isConversationsListResponse = (
  data: unknown,
): data is ConversationsListResponse => {
  return (
    isRecord(data) &&
    typeof data['ok'] === 'boolean' &&
    Array.isArray(data['channels'])
  );
};

const isUsersListResponse = (data: unknown): data is UsersListResponse => {
  return (
    isRecord(data) &&
    typeof data['ok'] === 'boolean' &&
    Array.isArray(data['members'])
  );
};

const isPostMessageResponse = (data: unknown): data is PostMessageResponse => {
  return isRecord(data) && typeof data['ok'] === 'boolean';
};

const isUploadUrlResponse = (data: unknown): data is UploadUrlResponse => {
  return (
    isRecord(data) &&
    typeof data['ok'] === 'boolean' &&
    'upload_url' in data &&
    'file_id' in data
  );
};

const isCompleteUploadResponse = (
  data: unknown,
): data is CompleteUploadResponse => {
  return isRecord(data) && typeof data['ok'] === 'boolean';
};

const isFileInfoResponse = (data: unknown): data is FileInfoResponse => {
  return isRecord(data) && typeof data['ok'] === 'boolean' && 'file' in data;
};

export class KySlackRepository implements SlackRepository {
  private readonly client: typeof ky;
  private readonly authHeader: string;
  private readonly baseUrl = 'https://slack.com/api';

  constructor(userToken: string) {
    if (!userToken.startsWith('xoxp-')) {
      throw new Error('Invalid user token. It should start with xoxp-');
    }
    this.authHeader = `Bearer ${userToken}`;
    this.client = ky.extend({
      retry: {
        limit: 3,
        methods: ['get', 'post'],
        statusCodes: [429, 500, 502, 503, 504],
      },
    });
  }

  async postMessageToChannel(
    message: string,
    channelName: string,
  ): Promise<{
    threadTs: string;
  }> {
    const data = await this.client
      .get(`${this.baseUrl}/conversations.list`, {
        headers: { Authorization: this.authHeader },
      })
      .json<ConversationsListResponse>();

    if (!isConversationsListResponse(data)) {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`);
    }

    const channel = data.channels.find((c) => c.name === channelName);
    if (!channel) throw new Error(`Channel ${channelName} not found`);

    const res = await this.client
      .post(`${this.baseUrl}/chat.postMessage`, {
        json: { channel: channel.id, text: message },
        headers: { Authorization: this.authHeader },
      })
      .json<PostMessageResponse>();

    if (!isPostMessageResponse(res)) {
      throw new Error(`Invalid response: ${JSON.stringify(res)}`);
    }
    if (!res.ok) {
      throw new Error(`Failed to post message: ${JSON.stringify(res)}`);
    }
    return { threadTs: res.ts };
  }

  async postMessageToChannelThread(
    message: string,
    channelName: string,
    threadTs: string,
  ): Promise<void> {
    const data = await this.client
      .get(`${this.baseUrl}/conversations.list`, {
        headers: { Authorization: this.authHeader },
      })
      .json<ConversationsListResponse>();

    if (!isConversationsListResponse(data)) {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`);
    }

    const channel = data.channels.find((c) => c.name === channelName);
    if (!channel) throw new Error(`Channel ${channelName} not found`);

    const res = await this.client
      .post(`${this.baseUrl}/chat.postMessage`, {
        json: { channel: channel.id, text: message, thread_ts: threadTs },
        headers: { Authorization: this.authHeader },
      })
      .json<PostMessageResponse>();

    if (!isPostMessageResponse(res)) {
      throw new Error(`Invalid response: ${JSON.stringify(res)}`);
    }
    if (!res.ok) {
      throw new Error(`Failed to post message: ${JSON.stringify(res)}`);
    }
  }

  async postMessageToDirectMessage(
    message: string,
    userName: string,
  ): Promise<void> {
    const data = await this.client
      .get(`${this.baseUrl}/users.list`, {
        headers: { Authorization: this.authHeader },
      })
      .json<UsersListResponse>();

    if (!isUsersListResponse(data)) {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`);
    }

    const user = data.members.find((u) => u.name === userName);
    if (!user) throw new Error(`User ${userName} not found`);

    const res = await this.client
      .post(`${this.baseUrl}/chat.postMessage`, {
        json: { channel: user.id, text: message },
        headers: { Authorization: this.authHeader },
      })
      .json<PostMessageResponse>();

    if (!isPostMessageResponse(res)) {
      throw new Error(`Invalid response: ${JSON.stringify(res)}`);
    }
    if (!res.ok) {
      throw new Error(`Failed to post message: ${JSON.stringify(res)}`);
    }
  }

  async postMessageToChannelWithImage(
    message: string,
    channelName: string,
    imageFilePath: string,
  ): Promise<void> {
    const data = await this.client
      .get(`${this.baseUrl}/conversations.list`, {
        headers: { Authorization: this.authHeader },
      })
      .json<ConversationsListResponse>();

    if (!isConversationsListResponse(data)) {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`);
    }

    const channel = data.channels.find((c) => c.name === channelName);
    if (!channel) throw new Error(`Channel ${channelName} not found`);

    const fileStats = fs.statSync(imageFilePath);
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
      .json<UploadUrlResponse>();

    if (!isUploadUrlResponse(uploadUrlRes)) {
      throw new Error(`Invalid response: ${JSON.stringify(uploadUrlRes)}`);
    }
    if (!uploadUrlRes.ok) {
      throw new Error(
        `Failed to get upload URL: ${JSON.stringify(uploadUrlRes)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const fileContent = fs.readFileSync(imageFilePath);
    await ky.post(uploadUrlRes.upload_url, {
      body: new Uint8Array(fileContent),
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const completeRes = await this.client
      .post(`${this.baseUrl}/files.completeUploadExternal`, {
        json: { files: [{ id: uploadUrlRes.file_id }] },
        headers: { Authorization: this.authHeader },
      })
      .json<CompleteUploadResponse>();

    if (!isCompleteUploadResponse(completeRes)) {
      throw new Error(`Invalid response: ${JSON.stringify(completeRes)}`);
    }
    if (!completeRes.ok) {
      throw new Error(
        `Failed to complete upload: ${JSON.stringify(completeRes)}`,
      );
    }

    const fileInfo = await this.client
      .get(`${this.baseUrl}/files.info?file=${uploadUrlRes.file_id}`, {
        headers: { Authorization: this.authHeader },
      })
      .json<FileInfoResponse>();

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
      .json<PostMessageResponse>();

    if (!isPostMessageResponse(res)) {
      throw new Error(`Invalid response: ${JSON.stringify(res)}`);
    }
    if (!res.ok) {
      throw new Error(`Failed to post message: ${JSON.stringify(res)}`);
    }
  }
}
