const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('ky', () => {
  const client = { get: mockGet, post: mockPost };
  return {
    default: {
      get: mockGet,
      post: mockPost,
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      extend: jest.fn(() => client),
      create: jest.fn(() => client),
      stop: jest.fn(),
    },
    __esModule: true,
  };
});

import { KySlackRepository } from './KySlackRepository';

const SLACK_USER_TOKEN = 'xoxp-dummy-token';
const TEST_CHANNEL_NAME = 'test-integration';
const TEST_USER_NAME = 'shikata.hiromi_test2';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

const channelsResponse = {
  ok: true,
  channels: [{ id: 'C123', name: TEST_CHANNEL_NAME }],
};
const usersResponse = {
  ok: true,
  members: [{ id: 'U123', name: TEST_USER_NAME }],
};

describe('KySlackRepository', () => {
  let slackRepository: KySlackRepository;

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    slackRepository = new KySlackRepository(SLACK_USER_TOKEN);
  });

  describe('postMessageToChannel', () => {
    it('should post a message to a channel', async () => {
      mockGet.mockReturnValue(mockJsonResponse(channelsResponse));
      mockPost.mockReturnValue(mockJsonResponse({ ok: true, ts: '123.456' }));

      const result = await slackRepository.postMessageToChannel(
        'Test message',
        TEST_CHANNEL_NAME,
      );

      expect(result).toEqual({ threadTs: '123.456' });
      expect(mockGet).toHaveBeenCalledWith(
        'https://slack.com/api/conversations.list',
        { headers: { Authorization: `Bearer ${SLACK_USER_TOKEN}` } },
      );
      expect(mockPost).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        {
          json: { channel: 'C123', text: 'Test message' },
          headers: { Authorization: `Bearer ${SLACK_USER_TOKEN}` },
        },
      );
    });

    it('should throw error for non-existent channel', async () => {
      mockGet.mockReturnValue(mockJsonResponse(channelsResponse));

      await expect(
        slackRepository.postMessageToChannel(
          'Test message',
          'non-existent-channel',
        ),
      ).rejects.toThrow('Channel non-existent-channel not found');
    });
  });

  describe('postMessageToChannelThread', () => {
    it('should post a message to a thread', async () => {
      mockGet.mockReturnValue(mockJsonResponse(channelsResponse));
      mockPost.mockReturnValue(mockJsonResponse({ ok: true, ts: '123.456' }));

      await expect(
        slackRepository.postMessageToChannelThread(
          'Test thread message',
          TEST_CHANNEL_NAME,
          '123.000',
        ),
      ).resolves.not.toThrow();

      expect(mockPost).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        {
          json: {
            channel: 'C123',
            text: 'Test thread message',
            thread_ts: '123.000',
          },
          headers: { Authorization: `Bearer ${SLACK_USER_TOKEN}` },
        },
      );
    });
  });

  describe('postMessageToChannelWithImage', () => {
    it('should throw error for non-existent image', async () => {
      mockGet.mockReturnValue(mockJsonResponse(channelsResponse));

      await expect(
        slackRepository.postMessageToChannelWithImage(
          'Test message',
          TEST_CHANNEL_NAME,
          'non-existent-image.png',
        ),
      ).rejects.toThrow();
    });
  });

  describe('postMessageToDirectMessage', () => {
    it('should post a direct message', async () => {
      mockGet.mockReturnValue(mockJsonResponse(usersResponse));
      mockPost.mockReturnValue(mockJsonResponse({ ok: true, ts: '123.456' }));

      await expect(
        slackRepository.postMessageToDirectMessage('Test DM', TEST_USER_NAME),
      ).resolves.not.toThrow();

      expect(mockGet).toHaveBeenCalledWith('https://slack.com/api/users.list', {
        headers: { Authorization: `Bearer ${SLACK_USER_TOKEN}` },
      });
      expect(mockPost).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        {
          json: { channel: 'U123', text: 'Test DM' },
          headers: { Authorization: `Bearer ${SLACK_USER_TOKEN}` },
        },
      );
    });

    it('should throw error for non-existent user', async () => {
      mockGet.mockReturnValue(mockJsonResponse(usersResponse));

      await expect(
        slackRepository.postMessageToDirectMessage(
          'Test message',
          'non-existent-user',
        ),
      ).rejects.toThrow('User non-existent-user not found');
    });
  });

  describe('constructor', () => {
    it('should throw error for invalid token prefix', () => {
      expect(() => new KySlackRepository('invalid-token')).toThrow(
        'Invalid user token. It should start with xoxp-',
      );
    });
  });
});
