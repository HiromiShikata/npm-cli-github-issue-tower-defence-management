import dotenv from 'dotenv';
import { AxiosSlackRepository } from './AxiosSlackRepository';
import fs from 'fs';
import https from 'https';
import path from 'path';

dotenv.config();

const SLACK_USER_TOKEN = process.env.SLACK_USER_TOKEN;
const TEST_CHANNEL_NAME = 'test-integration';
const TEST_USER_NAME = 'shikata.hiromi_test2';
const TEST_IMAGE_URL = 'https://i.imgur.com/Zi3qToQ.jpeg';
const TEST_IMAGE_PATH = './tmp/test/fixtures/test-image.png';

if (!SLACK_USER_TOKEN) {
  throw new Error('SLACK_USER_TOKEN is required');
}

describe('AxiosSlackRepository Integration Tests', () => {
  jest.setTimeout(30 * 1000);
  let slackRepository: AxiosSlackRepository;

  beforeAll(() => {
    slackRepository = new AxiosSlackRepository(SLACK_USER_TOKEN);
  });
  beforeEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  describe('postMessageToChannel', () => {
    it('should post a message to a channel', async () => {
      const message = `Test message ${new Date().toISOString()}`;

      await expect(
        slackRepository.postMessageToChannel(message, TEST_CHANNEL_NAME),
      ).resolves.not.toThrow();
    });

    it('should throw error for non-existent channel', async () => {
      const message = 'Test message';

      await expect(
        slackRepository.postMessageToChannel(message, 'non-existent-channel'),
      ).rejects.toThrow('Channel non-existent-channel not found');
    });
  });

  describe('postMessageToChannelThread', () => {
    it('should post a message to a thread', async () => {
      const message = `Test thread message ${new Date().toISOString()}`;
      const { threadTs } = await slackRepository.postMessageToChannel(
        `message for thread`,
        TEST_CHANNEL_NAME,
      );

      await expect(
        slackRepository.postMessageToChannelThread(
          message,
          TEST_CHANNEL_NAME,
          threadTs,
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('postMessageToChannelWithImage', () => {
    it.skip('should post a message with image', async () => {
      const message = `Test image message ${new Date().toISOString()}`;
      if (!fs.existsSync(path.dirname(TEST_IMAGE_PATH))) {
        fs.mkdirSync(path.dirname(TEST_IMAGE_PATH), { recursive: true });
        const res = https.get(TEST_IMAGE_URL, (res) =>
          res.pipe(fs.createWriteStream(TEST_IMAGE_PATH)),
        );
        await new Promise((resolve, reject) => {
          res.on('end', resolve);
          res.on('error', reject);
        });
      }

      await expect(
        slackRepository.postMessageToChannelWithImage(
          message,
          TEST_CHANNEL_NAME,
          TEST_IMAGE_PATH,
        ),
      ).resolves.not.toThrow();
    });

    it('should throw error for non-existent image', async () => {
      const message = 'Test message';

      await expect(
        slackRepository.postMessageToChannelWithImage(
          message,
          TEST_CHANNEL_NAME,
          'non-existent-image.png',
        ),
      ).rejects.toThrow();
    });
  });

  describe('postMessageToDirectMessage', () => {
    it('should post a direct message', async () => {
      const message = `Test DM ${new Date().toISOString()}`;

      await expect(
        slackRepository.postMessageToDirectMessage(message, TEST_USER_NAME),
      ).resolves.not.toThrow();
    });

    it('should throw error for non-existent user', async () => {
      const message = 'Test message';

      await expect(
        slackRepository.postMessageToDirectMessage(
          message,
          'non-existent-user',
        ),
      ).rejects.toThrow('User non-existent-user not found');
    });
  });
});
