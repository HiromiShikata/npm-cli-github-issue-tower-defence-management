import { OauthAPIProxyClaudeRepository } from './OauthAPIProxyClaudeRepository';
import { ClaudeRepository } from '../../domain/usecases/adapter-interfaces/ClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

describe('OauthAPIProxyClaudeRepository', () => {
  let mockProxyRepository: Mocked<Pick<ClaudeRepository, 'getUsage'>>;
  let mockApiRepository: Mocked<ClaudeRepository>;
  let repository: OauthAPIProxyClaudeRepository;

  const fiveHourUsage: ClaudeWindowUsage = {
    hour: 5,
    utilizationPercentage: 23,
    resetsAt: new Date(1772575200 * 1000),
  };

  const sevenDayUsage: ClaudeWindowUsage = {
    hour: 168,
    utilizationPercentage: 34,
    resetsAt: new Date(1772769600 * 1000),
  };

  const apiUsage: ClaudeWindowUsage = {
    hour: 5,
    utilizationPercentage: 50,
    resetsAt: new Date(),
  };

  beforeEach(() => {
    mockProxyRepository = {
      getUsage: jest.fn(),
    };
    mockApiRepository = {
      getUsage: jest.fn(),
      isClaudeAvailable: jest.fn(),
      getSelectedToken: jest.fn(),
    };
    repository = new OauthAPIProxyClaudeRepository(
      mockProxyRepository,
      mockApiRepository,
    );
  });

  describe('getUsage', () => {
    interface TestCase {
      name: string;
      proxyUsages: ClaudeWindowUsage[];
      apiUsages: ClaudeWindowUsage[];
      expected: ClaudeWindowUsage[];
      expectApiCalled: boolean;
    }

    const testCases: TestCase[] = [
      {
        name: 'returns proxy usages when proxy has data',
        proxyUsages: [fiveHourUsage, sevenDayUsage],
        apiUsages: [apiUsage],
        expected: [fiveHourUsage, sevenDayUsage],
        expectApiCalled: false,
      },
      {
        name: 'falls back to API usages when proxy has no data',
        proxyUsages: [],
        apiUsages: [apiUsage],
        expected: [apiUsage],
        expectApiCalled: true,
      },
    ];

    test.each(testCases)(
      '$name',
      async ({ proxyUsages, apiUsages, expected, expectApiCalled }) => {
        mockProxyRepository.getUsage.mockResolvedValue(proxyUsages);
        mockApiRepository.getUsage.mockResolvedValue(apiUsages);

        const result = await repository.getUsage();

        expect(result).toEqual(expected);
        if (expectApiCalled) {
          expect(mockApiRepository.getUsage.mock.calls).not.toHaveLength(0);
        } else {
          expect(mockApiRepository.getUsage.mock.calls).toHaveLength(0);
        }
      },
    );
  });

  describe('isClaudeAvailable', () => {
    interface TestCase {
      name: string;
      proxyUsages: ClaudeWindowUsage[];
      apiAvailable: boolean;
      threshold: number;
      expected: boolean;
      expectApiCalled: boolean;
    }

    const testCases: TestCase[] = [
      {
        name: 'returns true when proxy has data and all usages under threshold',
        proxyUsages: [fiveHourUsage, sevenDayUsage],
        apiAvailable: false,
        threshold: 90,
        expected: true,
        expectApiCalled: false,
      },
      {
        name: 'returns false when proxy has data and 5h usage above threshold',
        proxyUsages: [
          {
            hour: 5,
            utilizationPercentage: 95,
            resetsAt: new Date(),
          },
        ],
        apiAvailable: true,
        threshold: 90,
        expected: false,
        expectApiCalled: false,
      },
      {
        name: 'delegates to API when proxy has no data',
        proxyUsages: [],
        apiAvailable: true,
        threshold: 90,
        expected: true,
        expectApiCalled: true,
      },
      {
        name: 'returns API result when proxy has no data and API returns false',
        proxyUsages: [],
        apiAvailable: false,
        threshold: 90,
        expected: false,
        expectApiCalled: true,
      },
    ];

    test.each(testCases)(
      '$name',
      async ({
        proxyUsages,
        apiAvailable,
        threshold,
        expected,
        expectApiCalled,
      }) => {
        mockProxyRepository.getUsage.mockResolvedValue(proxyUsages);
        mockApiRepository.isClaudeAvailable.mockResolvedValue(apiAvailable);

        const result = await repository.isClaudeAvailable(threshold);

        expect(result).toBe(expected);
        if (expectApiCalled) {
          expect(mockApiRepository.isClaudeAvailable.mock.calls).toEqual([
            [threshold],
          ]);
        } else {
          expect(mockApiRepository.isClaudeAvailable.mock.calls).toHaveLength(
            0,
          );
        }
      },
    );
  });

  describe('getSelectedToken', () => {
    it('should delegate to API repository', () => {
      mockApiRepository.getSelectedToken.mockReturnValue('selected-token');

      const result = repository.getSelectedToken();

      expect(result).toBe('selected-token');
      expect(mockApiRepository.getSelectedToken.mock.calls).toHaveLength(1);
    });

    it('should return null when API repository returns null', () => {
      mockApiRepository.getSelectedToken.mockReturnValue(null);

      const result = repository.getSelectedToken();

      expect(result).toBe(null);
    });
  });
});
