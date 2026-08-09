import { DailySecurityScanUseCase } from './DailySecurityScanUseCase';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { HttpRepository } from './adapter-interfaces/HttpRepository';
import { mock } from 'jest-mock-extended';

const KEV_CATALOG_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

describe('DailySecurityScanUseCase', () => {
  const buildUseCase = () => {
    const mockLocalCommandRunner = mock<LocalCommandRunner>();
    const mockIssueRepository = mock<IssueRepository>();
    const mockHttpRepository = mock<HttpRepository>();
    const useCase = new DailySecurityScanUseCase(
      mockLocalCommandRunner,
      mockIssueRepository,
      mockHttpRepository,
    );
    return {
      useCase,
      mockLocalCommandRunner,
      mockIssueRepository,
      mockHttpRepository,
    };
  };

  describe('run', () => {
    it('does nothing when no target date matches the configured hour', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();

      await useCase.run({
        targetDates: [new Date('2024-01-01T03:30:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
        },
      });

      expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
    });

    it('does not run when the matching hour is not at minute zero', async () => {
      const { useCase, mockLocalCommandRunner } = buildUseCase();

      await useCase.run({
        targetDates: [new Date('2024-01-01T05:15:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
        },
      });

      expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    });

    it('scans repositories and creates an issue when osv-scanner finds vulnerabilities', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout: '/repos/example-org/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'git') {
            return {
              stdout: 'git@github.com:example-org/app.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'osv-scanner') {
            return {
              stdout: 'vulnerability detected in ' + args[args.length - 1],
              stderr: '',
              exitCode: 1,
            };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      );

      await useCase.run({
        targetDates: [new Date('2024-01-02T05:00:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
        },
      });

      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.createNewIssue.mock.calls[0][0]).toBe(
        'example-org',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][1]).toBe('app');
      expect(mockIssueRepository.createNewIssue.mock.calls[0][2]).toBe(
        'Daily security scan findings: 2024-01-02',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][4]).toEqual([
        'manager-name',
      ]);
    });

    it('does not create an issue when osv-scanner reports no vulnerabilities', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();

      mockLocalCommandRunner.runCommand.mockImplementation(async (program) => {
        if (program === 'find') {
          return {
            stdout: '/repos/example-org/app/.git\n',
            stderr: '',
            exitCode: 0,
          };
        }
        if (program === 'git') {
          return {
            stdout: 'git@github.com:example-org/app.git\n',
            stderr: '',
            exitCode: 0,
          };
        }
        return { stdout: 'no vulnerabilities', stderr: '', exitCode: 0 };
      });

      await useCase.run({
        targetDates: [new Date('2024-01-02T05:00:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
        },
      });

      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
    });

    it('skips repositories whose origin remote does not belong to the org', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();

      mockLocalCommandRunner.runCommand.mockImplementation(async (program) => {
        if (program === 'find') {
          return {
            stdout: '/repos/other-org/app/.git\n',
            stderr: '',
            exitCode: 0,
          };
        }
        if (program === 'git') {
          return {
            stdout: 'git@github.com:other-org/app.git\n',
            stderr: '',
            exitCode: 0,
          };
        }
        return { stdout: '', stderr: '', exitCode: 1 };
      });

      await useCase.run({
        targetDates: [new Date('2024-01-02T05:00:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
        },
      });

      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
      const osvScannerInvoked =
        mockLocalCommandRunner.runCommand.mock.calls.some(
          (call) => call[0] === 'osv-scanner',
        );
      expect(osvScannerInvoked).toBe(false);
    });

    it('skips repositories whose origin remote cannot be resolved', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();

      mockLocalCommandRunner.runCommand.mockImplementation(async (program) => {
        if (program === 'find') {
          return {
            stdout: '/repos/example-org/app/.git\n',
            stderr: '',
            exitCode: 0,
          };
        }
        if (program === 'git') {
          return {
            stdout: '',
            stderr: 'fatal: No such remote',
            exitCode: 2,
          };
        }
        return { stdout: '', stderr: '', exitCode: 1 };
      });

      await useCase.run({
        targetDates: [new Date('2024-01-02T05:00:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
        },
      });

      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
      const osvScannerInvoked =
        mockLocalCommandRunner.runCommand.mock.calls.some(
          (call) => call[0] === 'osv-scanner',
        );
      expect(osvScannerInvoked).toBe(false);
    });

    it('does not fetch the KEV catalog when KEV reporting is disabled', async () => {
      const { useCase, mockLocalCommandRunner, mockHttpRepository } =
        buildUseCase();

      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await useCase.run({
        targetDates: [new Date('2024-01-02T05:00:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
          enableKevNvdReport: false,
        },
      });

      expect(mockHttpRepository.get.mock.calls).toHaveLength(0);
    });

    it('does not fetch the KEV catalog when the report repo is missing', async () => {
      const { useCase, mockLocalCommandRunner, mockHttpRepository } =
        buildUseCase();

      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await useCase.run({
        targetDates: [new Date('2024-01-02T05:00:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
          enableKevNvdReport: true,
        },
      });

      expect(mockHttpRepository.get.mock.calls).toHaveLength(0);
    });

    it('creates a KEV report issue for vulnerabilities added since yesterday', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockIssueRepository,
        mockHttpRepository,
      } = buildUseCase();

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find' && args.includes('-maxdepth')) {
            return { stdout: '/repos/app/.git\n', stderr: '', exitCode: 0 };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      );
      mockHttpRepository.get.mockResolvedValue(
        JSON.stringify({
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0001',
              vendorProject: 'Example',
              product: 'NewProduct',
              vulnerabilityName: 'New Vulnerability',
              dateAdded: '2024-01-02',
            },
            {
              cveID: 'CVE-2023-9999',
              vendorProject: 'Example',
              product: 'OldProduct',
              vulnerabilityName: 'Old Vulnerability',
              dateAdded: '2023-12-31',
            },
          ],
        }),
      );

      await useCase.run({
        targetDates: [new Date('2024-01-02T05:00:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
          enableKevNvdReport: true,
          kevReportRepo: 'security-reports',
        },
      });

      expect(mockHttpRepository.get.mock.calls).toHaveLength(1);
      expect(mockHttpRepository.get.mock.calls[0][0]).toBe(KEV_CATALOG_URL);
      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.createNewIssue.mock.calls[0][0]).toBe(
        'example-org',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][1]).toBe(
        'security-reports',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][2]).toBe(
        'CISA KEV new additions since 2024-01-01',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).toContain(
        'CVE-2024-0001',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).not.toContain(
        'CVE-2023-9999',
      );
    });

    it('does not create a KEV report issue when there are no new additions', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockIssueRepository,
        mockHttpRepository,
      } = buildUseCase();

      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockHttpRepository.get.mockResolvedValue(
        JSON.stringify({
          vulnerabilities: [
            {
              cveID: 'CVE-2023-9999',
              vendorProject: 'Example',
              product: 'OldProduct',
              vulnerabilityName: 'Old Vulnerability',
              dateAdded: '2023-12-31',
            },
          ],
        }),
      );

      await useCase.run({
        targetDates: [new Date('2024-01-02T05:00:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
          enableKevNvdReport: true,
          kevReportRepo: 'security-reports',
        },
      });

      expect(mockHttpRepository.get.mock.calls).toHaveLength(1);
      expect(mockHttpRepository.get.mock.calls[0][0]).toBe(KEV_CATALOG_URL);
      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
    });

    it('does not create a KEV report issue when the product is absent from the scanned workspace', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockIssueRepository,
        mockHttpRepository,
      } = buildUseCase();

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find' && args.includes('-maxdepth')) {
            return {
              stdout: '/repos/app/.git\n/repos/site/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'git' && args.includes('grep')) {
            return { stdout: '', stderr: '', exitCode: 1 };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      );
      mockHttpRepository.get.mockResolvedValue(
        JSON.stringify({
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0001',
              vendorProject: 'Progress',
              product: 'LoadMaster',
              vulnerabilityName: 'Progress LoadMaster Command Injection',
              dateAdded: '2024-01-02',
            },
          ],
        }),
      );

      await useCase.run({
        targetDates: [new Date('2024-01-02T05:00:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
          enableKevNvdReport: true,
          kevReportRepo: 'security-reports',
        },
      });

      const gitGrepCalls = mockLocalCommandRunner.runCommand.mock.calls.filter(
        (call) => call[0] === 'git' && call[1].includes('grep'),
      );
      expect(gitGrepCalls.map((call) => call[1])).toEqual([
        [
          '-C',
          '/repos/app',
          'grep',
          '-I',
          '-i',
          '-q',
          '-F',
          '-e',
          'LoadMaster',
        ],
        [
          '-C',
          '/repos/site',
          'grep',
          '-I',
          '-i',
          '-q',
          '-F',
          '-e',
          'LoadMaster',
        ],
      ]);
      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
    });

    it('reports only the new KEV entries whose product is present in the scanned workspace', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockIssueRepository,
        mockHttpRepository,
      } = buildUseCase();

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find' && args.includes('-maxdepth')) {
            return { stdout: '/repos/app/.git\n', stderr: '', exitCode: 0 };
          }
          if (program === 'git' && args.includes('grep')) {
            return {
              stdout: '',
              stderr: '',
              exitCode: args.includes('LoadMaster') ? 1 : 0,
            };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      );
      mockHttpRepository.get.mockResolvedValue(
        JSON.stringify({
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0001',
              vendorProject: 'Progress',
              product: 'LoadMaster',
              vulnerabilityName: 'Progress LoadMaster Command Injection',
              dateAdded: '2024-01-02',
            },
            {
              cveID: 'CVE-2024-0002',
              vendorProject: 'Example',
              product: 'ExampleLibrary',
              vulnerabilityName: 'Example Library Deserialization',
              dateAdded: '2024-01-02',
            },
          ],
        }),
      );

      await useCase.run({
        targetDates: [new Date('2024-01-02T05:00:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
          enableKevNvdReport: true,
          kevReportRepo: 'security-reports',
        },
      });

      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).toContain(
        'CVE-2024-0002',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).not.toContain(
        'CVE-2024-0001',
      );
    });

    it('throws when the product search fails', async () => {
      const { useCase, mockLocalCommandRunner, mockHttpRepository } =
        buildUseCase();

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find' && args.includes('-maxdepth')) {
            return { stdout: '/repos/app/.git\n', stderr: '', exitCode: 0 };
          }
          if (program === 'git' && args.includes('grep')) {
            return {
              stdout: '',
              stderr: 'fatal: not a git repository',
              exitCode: 128,
            };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      );
      mockHttpRepository.get.mockResolvedValue(
        JSON.stringify({
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0001',
              vendorProject: 'Progress',
              product: 'LoadMaster',
              vulnerabilityName: 'Progress LoadMaster Command Injection',
              dateAdded: '2024-01-02',
            },
          ],
        }),
      );

      await expect(
        useCase.run({
          targetDates: [new Date('2024-01-02T05:00:00Z')],
          org: 'example-org',
          manager: 'manager-name',
          dailySecurityScan: {
            scanBaseDirectory: '/repos',
            targetHourUtc: 5,
            enableKevNvdReport: true,
            kevReportRepo: 'security-reports',
          },
        }),
      ).rejects.toThrow('Failed to search /repos/app for LoadMaster');
    });

    it('throws when the KEV catalog format is unexpected', async () => {
      const { useCase, mockLocalCommandRunner, mockHttpRepository } =
        buildUseCase();

      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockHttpRepository.get.mockResolvedValue(
        JSON.stringify({ unexpected: 'structure' }),
      );

      await expect(
        useCase.run({
          targetDates: [new Date('2024-01-02T05:00:00Z')],
          org: 'example-org',
          manager: 'manager-name',
          dailySecurityScan: {
            scanBaseDirectory: '/repos',
            targetHourUtc: 5,
            enableKevNvdReport: true,
            kevReportRepo: 'security-reports',
          },
        }),
      ).rejects.toThrow('Unexpected CISA KEV catalog format');
    });
  });
});
