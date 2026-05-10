jest.mock('fs');

import fs from 'fs';
import { OauthProxyClaudeRepository } from './OauthProxyClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';

describe('OauthProxyClaudeRepository', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getUsage', () => {
    interface TestCase {
      name: string;
      fileExists: boolean;
      fileContent: string | null;
      expected: ClaudeWindowUsage[];
    }

    const testCases: TestCase[] = [
      {
        name: 'returns empty array when file does not exist',
        fileExists: false,
        fileContent: null,
        expected: [],
      },
      {
        name: 'returns empty array when file content is invalid JSON',
        fileExists: true,
        fileContent: 'invalid-json',
        expected: [],
      },
      {
        name: 'returns empty array when file has no headers property',
        fileExists: true,
        fileContent: JSON.stringify({ ts: 1234567890 }),
        expected: [],
      },
      {
        name: 'returns 5h usage from proxy file',
        fileExists: true,
        fileContent: JSON.stringify({
          headers: {
            'anthropic-ratelimit-unified-5h-utilization': '0.23',
            'anthropic-ratelimit-unified-5h-reset': '1772575200',
          },
          ts: 1234567890,
        }),
        expected: [
          {
            hour: 5,
            utilizationPercentage: 23,
            resetsAt: new Date(1772575200 * 1000),
          },
        ],
      },
      {
        name: 'returns 7d usage from proxy file',
        fileExists: true,
        fileContent: JSON.stringify({
          headers: {
            'anthropic-ratelimit-unified-7d-utilization': '0.34',
            'anthropic-ratelimit-unified-7d-reset': '1772769600',
          },
          ts: 1234567890,
        }),
        expected: [
          {
            hour: 168,
            utilizationPercentage: 34,
            resetsAt: new Date(1772769600 * 1000),
          },
        ],
      },
      {
        name: 'returns both 5h and 7d usage from proxy file',
        fileExists: true,
        fileContent: JSON.stringify({
          headers: {
            'anthropic-ratelimit-unified-5h-utilization': '0.23',
            'anthropic-ratelimit-unified-5h-reset': '1772575200',
            'anthropic-ratelimit-unified-7d-utilization': '0.34',
            'anthropic-ratelimit-unified-7d-reset': '1772769600',
          },
          ts: 1234567890,
        }),
        expected: [
          {
            hour: 5,
            utilizationPercentage: 23,
            resetsAt: new Date(1772575200 * 1000),
          },
          {
            hour: 168,
            utilizationPercentage: 34,
            resetsAt: new Date(1772769600 * 1000),
          },
        ],
      },
    ];

    test.each(testCases)(
      '$name',
      async ({ fileExists, fileContent, expected }) => {
        jest.mocked(fs.existsSync).mockReturnValue(fileExists);
        if (fileContent !== null) {
          jest.mocked(fs.readFileSync).mockReturnValue(fileContent);
        }

        const repository = new OauthProxyClaudeRepository(
          '/tmp/test-claude-ratelimit.json',
        );
        const result = await repository.getUsage();

        expect(result).toEqual(expected);
      },
    );
  });

  describe('isClaudeAvailable', () => {
    interface TestCase {
      name: string;
      fileExists: boolean;
      fileContent: string | null;
      threshold: number;
      expected: boolean;
    }

    const testCases: TestCase[] = [
      {
        name: 'returns false when no proxy data available',
        fileExists: false,
        fileContent: null,
        threshold: 90,
        expected: false,
      },
      {
        name: 'returns true when all usages are under threshold',
        fileExists: true,
        fileContent: JSON.stringify({
          headers: {
            'anthropic-ratelimit-unified-5h-utilization': '0.50',
            'anthropic-ratelimit-unified-5h-reset': '1772575200',
            'anthropic-ratelimit-unified-7d-utilization': '0.30',
            'anthropic-ratelimit-unified-7d-reset': '1772769600',
          },
          ts: 1234567890,
        }),
        threshold: 90,
        expected: true,
      },
      {
        name: 'returns false when 5h usage is above threshold',
        fileExists: true,
        fileContent: JSON.stringify({
          headers: {
            'anthropic-ratelimit-unified-5h-utilization': '0.95',
            'anthropic-ratelimit-unified-5h-reset': '1772575200',
          },
          ts: 1234567890,
        }),
        threshold: 90,
        expected: false,
      },
      {
        name: 'returns false when 7d usage is above threshold',
        fileExists: true,
        fileContent: JSON.stringify({
          headers: {
            'anthropic-ratelimit-unified-5h-utilization': '0.50',
            'anthropic-ratelimit-unified-5h-reset': '1772575200',
            'anthropic-ratelimit-unified-7d-utilization': '0.95',
            'anthropic-ratelimit-unified-7d-reset': '1772769600',
          },
          ts: 1234567890,
        }),
        threshold: 90,
        expected: false,
      },
      {
        name: 'returns false when usage equals threshold',
        fileExists: true,
        fileContent: JSON.stringify({
          headers: {
            'anthropic-ratelimit-unified-5h-utilization': '0.90',
            'anthropic-ratelimit-unified-5h-reset': '1772575200',
          },
          ts: 1234567890,
        }),
        threshold: 90,
        expected: false,
      },
    ];

    test.each(testCases)(
      '$name',
      async ({ fileExists, fileContent, threshold, expected }) => {
        jest.mocked(fs.existsSync).mockReturnValue(fileExists);
        if (fileContent !== null) {
          jest.mocked(fs.readFileSync).mockReturnValue(fileContent);
        }

        const repository = new OauthProxyClaudeRepository(
          '/tmp/test-claude-ratelimit.json',
        );
        const result = await repository.isClaudeAvailable(threshold);

        expect(result).toBe(expected);
      },
    );
  });
});
