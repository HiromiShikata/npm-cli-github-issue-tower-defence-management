import { SlackRepository } from '../../domain/usecases/adapter-interfaces/SlackRepository';
export declare class AxiosSlackRepository implements SlackRepository {
    private readonly client;
    private readonly baseUrl;
    constructor(userToken: string);
    postMessageToChannel(message: string, channelName: string): Promise<{
        threadTs: string;
    }>;
    postMessageToChannelThread(message: string, channelName: string, threadTs: string): Promise<void>;
    postMessageToDirectMessage(message: string, userName: string): Promise<void>;
    postMessageToChannelWithImage(message: string, channelName: string, imageFilePath: string): Promise<void>;
}
//# sourceMappingURL=AxiosSlackRepository.d.ts.map