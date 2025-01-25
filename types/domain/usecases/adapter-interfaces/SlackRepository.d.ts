export interface SlackRepository {
    postMessageToChannel: (message: string, channelName: string) => Promise<{
        threadTs: string;
    }>;
    postMessageToChannelThread: (message: string, channelName: string, threadTs: string) => Promise<void>;
    postMessageToChannelWithImage: (message: string, channelName: string, imageFilePath: string) => Promise<void>;
    postMessageToDirectMessage: (message: string, userName: string) => Promise<void>;
}
//# sourceMappingURL=SlackRepository.d.ts.map