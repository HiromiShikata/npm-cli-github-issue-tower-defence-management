import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import { SlackRepository } from '../../domain/usecases/adapter-interfaces/SlackRepository';

export class AxiosSlackRepository implements SlackRepository {
  private readonly client: AxiosInstance;
  private readonly baseUrl = 'https://slack.com/api';

  constructor(userToken: string) {
    if (!userToken.startsWith('xoxp-')) {
      throw new Error('Invalid user token. It should start with xoxp-');
    }
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
  }

  async postMessageToChannel(
    message: string,
    channelName: string,
  ): Promise<{
    threadTs: string;
  }> {
    const { data } = await this.client.get<{
      ok: boolean;
      channels: { id: string; name: string }[];
    }>('/conversations.list');

    const channel = data.channels.find((c) => c.name === channelName);
    if (!channel) throw new Error(`Channel ${channelName} not found`);

    const res = await this.client.post<{ ok: boolean; ts: string }>(
      '/chat.postMessage',
      {
        channel: channel.id,
        text: message,
      },
    );
    if (!res.data.ok) {
      throw new Error(`Failed to post message: ${JSON.stringify(res.data)}`);
    }
    return {
      threadTs: res.data.ts,
    };
  }

  async postMessageToChannelThread(
    message: string,
    channelName: string,
    threadTs: string,
  ): Promise<void> {
    const { data } = await this.client.get<{
      ok: boolean;
      channels: { id: string; name: string }[];
    }>('/conversations.list');

    const channel = data.channels.find((c) => c.name === channelName);
    if (!channel) throw new Error(`Channel ${channelName} not found`);

    const res = await this.client.post<{ ok: boolean }>('/chat.postMessage', {
      channel: channel.id,
      text: message,
      thread_ts: threadTs,
    });
    if (!res.data.ok) {
      throw new Error(`Failed to post message: ${JSON.stringify(res.data)}`);
    }
  }

  async postMessageToDirectMessage(
    message: string,
    userName: string,
  ): Promise<void> {
    const { data } = await this.client.get<{
      ok: boolean;
      members: { id: string; name: string }[];
    }>('/users.list');

    const user = data.members.find((u) => u.name === userName);
    if (!user) throw new Error(`User ${userName} not found`);

    const res = await this.client.post<{ ok: boolean }>('/chat.postMessage', {
      channel: user.id,
      text: message,
    });
    if (!res.data.ok) {
      throw new Error(`Failed to post message: ${JSON.stringify(res.data)}`);
    }
  }
  async postMessageToChannelWithImage(
    message: string,
    channelName: string,
    imageFilePath: string,
  ): Promise<void> {
    const { data } = await this.client.get<{
      ok: boolean;
      channels: { id: string; name: string }[];
    }>('/conversations.list');

    const channel = data.channels.find((c) => c.name === channelName);
    if (!channel) throw new Error(`Channel ${channelName} not found`);

    const fileStats = fs.statSync(imageFilePath);
    const fileName = imageFilePath.split('/').pop();

    const uploadUrlRes = await this.client.post<{
      ok: boolean;
      upload_url: string;
      file_id: string;
    }>(
      '/files.getUploadURLExternal',
      {
        filename: fileName,
        length: fileStats.size,
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        },
      },
    );
    if (!uploadUrlRes.data.ok) {
      throw new Error(
        `Failed to get upload URL: ${JSON.stringify(uploadUrlRes.data)}`,
      );
    }

    const fileContent = fs.readFileSync(imageFilePath);
    await axios.post(uploadUrlRes.data.upload_url, fileContent, {
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });

    const completeRes = await this.client.post<{ ok: boolean }>(
      '/files.completeUploadExternal',
      {
        files: [
          {
            id: uploadUrlRes.data.file_id,
          },
        ],
      },
    );
    if (!completeRes.data.ok) {
      throw new Error(
        `Failed to complete upload: ${JSON.stringify(completeRes.data)}`,
      );
    }

    const fileInfo = await this.client.get<{
      ok: boolean;
      file: { url_private: string };
    }>(`/files.info?file=${uploadUrlRes.data.file_id}`);

    if (!fileInfo.data.ok) {
      throw new Error(
        `Failed to get file info: ${JSON.stringify(fileInfo.data)}`,
      );
    }

    const imageUrl = fileInfo.data.file.url_private;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const res = await this.client.post<{ ok: boolean }>('/chat.postMessage', {
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
