import { DailySecurityScanUseCase } from './DailySecurityScanUseCase';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { HttpRepository } from './adapter-interfaces/HttpRepository';
import { KevReportWatermarkRepository } from './adapter-interfaces/KevReportWatermarkRepository';
import { mock } from 'jest-mock-extended';

const KEV_CATALOG_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

describe('DailySecurityScanUseCase', () => {
  const buildUseCase = () => {
    const mockLocalCommandRunner = mock<LocalCommandRunner>();
    const mockIssueRepository = mock<IssueRepository>();
    const mockHttpRepository = mock<HttpRepository>();
    const mockKevReportWatermarkRepository =
      mock<KevReportWatermarkRepository>();
    mockKevReportWatermarkRepository.load.mockResolvedValue({ type: 'absent' });
    const useCase = new DailySecurityScanUseCase(
      mockLocalCommandRunner,
      mockIssueRepository,
      mockHttpRepository,
      mockKevReportWatermarkRepository,
    );
    return {
      useCase,
      mockLocalCommandRunner,
      mockIssueRepository,
      mockHttpRepository,
      mockKevReportWatermarkRepository,
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

      mockIssueRepository.searchIssue.mockResolvedValue([]);

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout: '/repos/example-org/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
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
        'Daily security scan findings',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][4]).toEqual([
        'manager-name',
      ]);
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).not.toContain(
        'From: :robot:',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).toContain(
        '## OSV-Scanner findings',
      );
    });

    const buildDefaultBranchScanRunner = () => {
      const scannerFindings = JSON.stringify({
        results: [
          {
            packages: [
              {
                package: {
                  name: 'example-library',
                  version: '1.2.3',
                  ecosystem: 'npm',
                },
                vulnerabilities: [
                  {
                    id: 'GHSA-1111-2222-3333',
                    aliases: [],
                    summary: 'Example Library Deserialization',
                  },
                ],
              },
            ],
          },
        ],
      });
      return async (program: string, args: string[]) => {
        if (program === 'find') {
          return {
            stdout: '/repos/workspace1/app/.git\n/repos/workspace2/app/.git\n',
            stderr: '',
            exitCode: 0,
          };
        }
        if (program === 'mktemp') {
          return {
            stdout: '/tmp/tdpm-daily-security-scan-app-abc123\n',
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
          return { stdout: scannerFindings, stderr: '', exitCode: 1 };
        }
        if (program === 'rm') {
          return { stdout: args.join(' '), stderr: '', exitCode: 0 };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      };
    };

    it('scans one fresh checkout of the default branch instead of the working copies on disk', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();

      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockLocalCommandRunner.runCommand.mockImplementation(
        buildDefaultBranchScanRunner(),
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

      const cloneCalls = mockLocalCommandRunner.runCommand.mock.calls.filter(
        (call) => call[0] === 'git' && call[1][0] === 'clone',
      );
      expect(cloneCalls).toHaveLength(1);
      expect(cloneCalls[0][1]).toEqual([
        'clone',
        '--depth',
        '1',
        'git@github.com:example-org/app.git',
        '/tmp/tdpm-daily-security-scan-app-abc123',
      ]);

      const scanCalls = mockLocalCommandRunner.runCommand.mock.calls.filter(
        (call) => call[0] === 'osv-scanner',
      );
      expect(scanCalls).toHaveLength(1);
      expect(scanCalls[0][1][scanCalls[0][1].indexOf('-r') + 1]).toBe(
        '/tmp/tdpm-daily-security-scan-app-abc123',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.createNewIssue.mock.calls[0][1]).toBe('app');
    });

    it('logs an error and scans nothing for a repository whose default branch clone fails', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout: '/repos/workspace1/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'mktemp') {
            return {
              stdout: '/tmp/tdpm-daily-security-scan-app-abc123\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'git' && args[0] === 'clone') {
            return {
              stdout: '',
              stderr: 'fatal: repository not found',
              exitCode: 128,
            };
          }
          if (program === 'git') {
            return {
              stdout: 'git@github.com:example-org/app.git\n',
              stderr: '',
              exitCode: 0,
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

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clone the default branch of app'),
      );
      const scanCalls = mockLocalCommandRunner.runCommand.mock.calls.filter(
        (call) => call[0] === 'osv-scanner',
      );
      expect(scanCalls).toHaveLength(0);
      const removeCalls = mockLocalCommandRunner.runCommand.mock.calls.filter(
        (call) => call[0] === 'rm',
      );
      expect(removeCalls).toHaveLength(1);
      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
      errorSpy.mockRestore();
    });

    it('removes the temporary checkout after scanning it', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();

      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockLocalCommandRunner.runCommand.mockImplementation(
        buildDefaultBranchScanRunner(),
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

      const removeCalls = mockLocalCommandRunner.runCommand.mock.calls.filter(
        (call) => call[0] === 'rm',
      );
      expect(removeCalls).toHaveLength(1);
      expect(removeCalls[0][1]).toEqual([
        '-rf',
        '/tmp/tdpm-daily-security-scan-app-abc123',
      ]);
    });

    it('does not create an issue when osv-scanner reports no vulnerabilities', async () => {
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
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
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

      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
    });

    it('skips repositories whose origin remote does not belong to the org', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout: '/repos/other-org/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
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

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout: '/repos/example-org/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
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

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout: '/repos/example-org/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
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
          enableKevNvdReport: false,
        },
      });

      expect(mockHttpRepository.get.mock.calls).toHaveLength(0);
    });

    it('does not fetch the KEV catalog when the report repo is missing', async () => {
      const { useCase, mockLocalCommandRunner, mockHttpRepository } =
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
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
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

      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout: '/repos/example-org/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
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
              stdout: JSON.stringify({
                results: [
                  {
                    source: {
                      path: '/repos/example-org/app',
                      type: 'lockfile',
                    },
                    packages: [
                      {
                        package: {
                          name: 'example-library',
                          version: '1.2.3',
                          ecosystem: 'npm',
                        },
                        vulnerabilities: [
                          {
                            id: 'GHSA-1111-2222-3333',
                            aliases: ['CVE-2024-0001', 'CVE-2023-9999'],
                            summary: 'New Vulnerability',
                          },
                        ],
                      },
                    ],
                  },
                ],
              }),
              stderr: '',
              exitCode: 1,
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
      const kevIssueCalls =
        mockIssueRepository.createNewIssue.mock.calls.filter(
          (call) => call[1] === 'security-reports',
        );
      expect(kevIssueCalls).toHaveLength(1);
      expect(kevIssueCalls[0][0]).toBe('example-org');
      expect(kevIssueCalls[0][2]).toBe(
        'CISA KEV new additions since 2024-01-01',
      );
      expect(kevIssueCalls[0][3]).toContain('CVE-2024-0001');
      expect(kevIssueCalls[0][3]).not.toContain('CVE-2023-9999');
      expect(kevIssueCalls[0][3]).not.toContain('From: :robot:');
    });

    it('does not create a KEV report issue when there are no new additions', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockIssueRepository,
        mockHttpRepository,
      } = buildUseCase();

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout: '/repos/example-org/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
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
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      );
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

    it('throws when the KEV catalog format is unexpected', async () => {
      const { useCase, mockLocalCommandRunner, mockHttpRepository } =
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
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
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
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      );
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

    it('logs an error and returns without throwing when no repositories are found in the scan base directory', async () => {
      const { useCase, mockLocalCommandRunner } = buildUseCase();
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      mockLocalCommandRunner.runCommand.mockImplementation(async (program) => {
        if (program === 'find') {
          return { stdout: '', stderr: '', exitCode: 0 };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });

      await expect(
        useCase.run({
          targetDates: [new Date('2024-01-02T05:00:00Z')],
          org: 'example-org',
          manager: 'manager-name',
          dailySecurityScan: {
            scanBaseDirectory: '/repos',
            targetHourUtc: 5,
          },
        }),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        'No repositories found in scan base directory: /repos',
      );

      errorSpy.mockRestore();
    });

    it('logs an error and continues scanning remaining repositories when osv-scanner exits with an unexpected code', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      mockIssueRepository.searchIssue.mockResolvedValue([]);

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout:
                '/repos/example-org/broken/.git\n/repos/example-org/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'git') {
            const dir = args[1];
            const repo = dir.split('/').pop() ?? '';
            return {
              stdout: `git@github.com:example-org/${repo}.git\n`,
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'osv-scanner') {
            const scannedDirectory = args[args.indexOf('-r') + 1];
            if (scannedDirectory.includes('broken')) {
              return {
                stdout: '',
                stderr: 'osv-scanner: command not found',
                exitCode: 127,
              };
            }
            return {
              stdout: JSON.stringify({
                results: [
                  {
                    source: { path: scannedDirectory, type: 'lockfile' },
                    packages: [
                      {
                        package: {
                          name: 'example-library',
                          version: '1.2.3',
                          ecosystem: 'npm',
                        },
                        vulnerabilities: [
                          {
                            id: 'GHSA-1111-2222-3333',
                            aliases: [],
                            summary: 'Example Library Deserialization',
                          },
                        ],
                      },
                    ],
                  },
                ],
              }),
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

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('osv-scanner failed with exit code 127'),
      );
      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.createNewIssue.mock.calls[0][1]).toBe('app');
      errorSpy.mockRestore();
    });

    it('logs an error and continues scanning remaining repositories when creating the findings issue fails', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockImplementation(
        async (_org, repositoryName) => {
          if (repositoryName === 'archived') {
            throw new Error(
              'Request failed with status code 403: Repository was archived so is read-only.',
            );
          }
          return 1;
        },
      );

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout:
                '/repos/example-org/archived/.git\n/repos/example-org/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'git') {
            const dir = args[1];
            const repo = dir.split('/').pop() ?? '';
            return {
              stdout: `git@github.com:example-org/${repo}.git\n`,
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'osv-scanner') {
            return {
              stdout: JSON.stringify({
                results: [
                  {
                    source: {
                      path: args[args.indexOf('-r') + 1],
                      type: 'lockfile',
                    },
                    packages: [
                      {
                        package: {
                          name: 'example-library',
                          version: '1.2.3',
                          ecosystem: 'npm',
                        },
                        vulnerabilities: [
                          {
                            id: 'GHSA-1111-2222-3333',
                            aliases: [],
                            summary: 'Example Library Deserialization',
                          },
                        ],
                      },
                    ],
                  },
                ],
              }),
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

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('archived'),
      );
      expect(
        mockIssueRepository.createNewIssue.mock.calls.map((call) => call[1]),
      ).toEqual(['archived', 'app']);
      errorSpy.mockRestore();
    });

    it('logs an error and continues scanning remaining repositories when commenting on the existing findings issue fails', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      mockIssueRepository.searchIssue.mockImplementation(
        async ({ repositoryName }) =>
          repositoryName === 'oversized'
            ? [
                {
                  url: 'https://github.com/example-org/oversized/issues/1',
                  title: 'Daily security scan findings',
                  number: '1',
                },
              ]
            : [],
      );
      mockIssueRepository.createCommentByUrl.mockRejectedValue(
        new Error('Request failed with status code 422: Validation Failed'),
      );

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout:
                '/repos/example-org/oversized/.git\n/repos/example-org/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'git') {
            const dir = args[1];
            const repo = dir.split('/').pop() ?? '';
            return {
              stdout: `git@github.com:example-org/${repo}.git\n`,
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'osv-scanner') {
            return {
              stdout: JSON.stringify({
                results: [
                  {
                    source: {
                      path: args[args.indexOf('-r') + 1],
                      type: 'lockfile',
                    },
                    packages: [
                      {
                        package: {
                          name: 'example-library',
                          version: '1.2.3',
                          ecosystem: 'npm',
                        },
                        vulnerabilities: [
                          {
                            id: 'GHSA-1111-2222-3333',
                            aliases: [],
                            summary: 'Example Library Deserialization',
                          },
                        ],
                      },
                    ],
                  },
                ],
              }),
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

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('oversized'),
      );
      expect(
        mockIssueRepository.createNewIssue.mock.calls.map((call) => call[1]),
      ).toEqual(['app']);
      errorSpy.mockRestore();
    });

    it('adds a comment to the existing open issue for the repository instead of creating a new one', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();

      mockIssueRepository.searchIssue.mockResolvedValue([
        {
          url: 'https://github.com/example-org/app/issues/42',
          title: 'Daily security scan findings',
          number: '42',
        },
      ]);

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout: '/repos/example-org/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
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
            return { stdout: 'vulnerability found', stderr: '', exitCode: 1 };
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

      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.createCommentByUrl.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.createCommentByUrl.mock.calls[0][0]).toBe(
        'https://github.com/example-org/app/issues/42',
      );
      expect(mockIssueRepository.createCommentByUrl.mock.calls[0][1]).toContain(
        '2024-01-02',
      );
    });

    it('creates a new issue when no existing open issue exists for the repository', async () => {
      const { useCase, mockLocalCommandRunner, mockIssueRepository } =
        buildUseCase();

      mockIssueRepository.searchIssue.mockResolvedValue([]);

      mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout: '/repos/example-org/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
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
            return { stdout: 'vulnerability found', stderr: '', exitCode: 1 };
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
      expect(mockIssueRepository.createNewIssue.mock.calls[0][2]).toBe(
        'Daily security scan findings',
      );
      expect(mockIssueRepository.createCommentByUrl.mock.calls).toHaveLength(0);
    });

    const osvScanOutput = (
      vulnerablePackages: {
        name: string;
        version: string;
        ecosystem: string;
        id: string;
        aliases: string[];
        summary: string;
      }[],
    ): string =>
      JSON.stringify({
        results: [
          {
            source: { path: '/repos/example-org/app', type: 'lockfile' },
            packages: vulnerablePackages.map((vulnerablePackage) => ({
              package: {
                name: vulnerablePackage.name,
                version: vulnerablePackage.version,
                ecosystem: vulnerablePackage.ecosystem,
              },
              vulnerabilities: [
                {
                  id: vulnerablePackage.id,
                  aliases: vulnerablePackage.aliases,
                  summary: vulnerablePackage.summary,
                },
              ],
            })),
          },
        ],
      });

    const buildScanEnvironment = (scanOutput: string, kevCatalog: unknown) => {
      const built = buildUseCase();
      built.mockIssueRepository.searchIssue.mockResolvedValue([]);
      built.mockLocalCommandRunner.runCommand.mockImplementation(
        async (program, args) => {
          if (program === 'find') {
            return {
              stdout: '/repos/example-org/app/.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (program === 'mktemp') {
            return {
              stdout: `/tmp/${args[args.length - 1].replace('XXXXXX', 'abc123')}\n`,
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
            return { stdout: scanOutput, stderr: '', exitCode: 1 };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      );
      built.mockHttpRepository.get.mockResolvedValue(
        JSON.stringify(kevCatalog),
      );
      return built;
    };

    const kevReportCalls = (
      calls: [string, string, string, string, string[], string[]][],
    ) => calls.filter((call) => call[1] === 'security-reports');

    const runWithKevReporting = async (useCase: DailySecurityScanUseCase) =>
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
      });

    it('still reports KEV additions when the scanned repository findings issue cannot be written', async () => {
      const { useCase, mockIssueRepository } = buildScanEnvironment(
        osvScanOutput([
          {
            name: 'example-library',
            version: '1.2.3',
            ecosystem: 'npm',
            id: 'GHSA-1111-2222-3333',
            aliases: ['CVE-2024-0001'],
            summary: 'Example Library Deserialization',
          },
        ]),
        {
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0001',
              vendorProject: 'Example',
              product: 'Example Library',
              vulnerabilityName: 'Example Library Deserialization',
              dateAdded: '2024-01-02',
            },
          ],
        },
      );
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      mockIssueRepository.createNewIssue.mockImplementation(
        async (_org, repositoryName) => {
          if (repositoryName === 'app') {
            throw new Error(
              'Request failed with status code 403: Repository was archived so is read-only.',
            );
          }
          return 1;
        },
      );

      await runWithKevReporting(useCase);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('app'));
      expect(
        kevReportCalls(mockIssueRepository.createNewIssue.mock.calls),
      ).toHaveLength(1);
      errorSpy.mockRestore();
    });

    it('reports a KEV addition whose CVE the scanner found at an installed version', async () => {
      const { useCase, mockIssueRepository } = buildScanEnvironment(
        osvScanOutput([
          {
            name: 'example-library',
            version: '1.2.3',
            ecosystem: 'npm',
            id: 'GHSA-1111-2222-3333',
            aliases: ['CVE-2024-0001'],
            summary: 'Example Library Deserialization',
          },
        ]),
        {
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0001',
              vendorProject: 'Example',
              product: 'ExampleLibrary',
              vulnerabilityName: 'Example Library Deserialization',
              dateAdded: '2024-01-02',
            },
          ],
        },
      );

      await runWithKevReporting(useCase);

      const kevCalls = kevReportCalls(
        mockIssueRepository.createNewIssue.mock.calls,
      );
      expect(kevCalls).toHaveLength(1);
      expect(kevCalls[0][3]).toContain('CVE-2024-0001');
      expect(kevCalls[0][3]).toContain('app');
      expect(kevCalls[0][3]).toContain('example-library');
      expect(kevCalls[0][3]).toContain('1.2.3');
    });

    it('does not report a KEV addition that the scanner did not find in any repository', async () => {
      const { useCase, mockIssueRepository } = buildScanEnvironment(
        osvScanOutput([
          {
            name: 'example-library',
            version: '1.2.3',
            ecosystem: 'npm',
            id: 'GHSA-1111-2222-3333',
            aliases: ['CVE-2024-0001'],
            summary: 'Example Library Deserialization',
          },
        ]),
        {
          vulnerabilities: [
            {
              cveID: 'CVE-2024-9999',
              vendorProject: 'Progress',
              product: 'LoadMaster',
              vulnerabilityName: 'Progress LoadMaster Command Injection',
              dateAdded: '2024-01-02',
            },
          ],
        },
      );

      await runWithKevReporting(useCase);

      expect(
        kevReportCalls(mockIssueRepository.createNewIssue.mock.calls),
      ).toHaveLength(0);
    });

    it('reports a KEV addition whose CVE the scanner returned as the vulnerability id rather than an alias', async () => {
      const { useCase, mockIssueRepository } = buildScanEnvironment(
        osvScanOutput([
          {
            name: 'example-library',
            version: '1.2.3',
            ecosystem: 'npm',
            id: 'CVE-2024-0001',
            aliases: [],
            summary: 'Example Library Deserialization',
          },
        ]),
        {
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0001',
              vendorProject: 'Example',
              product: 'ExampleLibrary',
              vulnerabilityName: 'Example Library Deserialization',
              dateAdded: '2024-01-02',
            },
          ],
        },
      );

      await runWithKevReporting(useCase);

      expect(
        kevReportCalls(mockIssueRepository.createNewIssue.mock.calls),
      ).toHaveLength(1);
    });

    it('does not search the repositories for the KEV product name', async () => {
      const { useCase, mockLocalCommandRunner } = buildScanEnvironment(
        osvScanOutput([
          {
            name: 'example-library',
            version: '1.2.3',
            ecosystem: 'npm',
            id: 'GHSA-1111-2222-3333',
            aliases: ['CVE-2024-0001'],
            summary: 'Example Library Deserialization',
          },
        ]),
        {
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0001',
              vendorProject: 'Example',
              product: 'ExampleLibrary',
              vulnerabilityName: 'Example Library Deserialization',
              dateAdded: '2024-01-02',
            },
          ],
        },
      );

      await runWithKevReporting(useCase);

      const grepCalls = mockLocalCommandRunner.runCommand.mock.calls.filter(
        (call) => call[0] === 'git' && call[1].includes('grep'),
      );
      expect(grepCalls).toHaveLength(0);
    });

    const scannedExampleLibrary = osvScanOutput([
      {
        name: 'example-library',
        version: '1.2.3',
        ecosystem: 'npm',
        id: 'GHSA-1111-2222-3333',
        aliases: ['CVE-2024-0001', 'CVE-2024-0002', 'CVE-2024-0003'],
        summary: 'Example Library Deserialization',
      },
    ]);

    const kevCatalogOf = (
      vulnerabilities: { cveID: string; dateAdded: string }[],
    ) => ({
      vulnerabilities: vulnerabilities.map((vulnerability) => ({
        cveID: vulnerability.cveID,
        vendorProject: 'Example',
        product: 'ExampleLibrary',
        vulnerabilityName: `${vulnerability.cveID} Deserialization`,
        dateAdded: vulnerability.dateAdded,
      })),
    });

    it('records every addition it considered in the watermark after the report issue is created', async () => {
      const { useCase, mockIssueRepository, mockKevReportWatermarkRepository } =
        buildScanEnvironment(
          scannedExampleLibrary,
          kevCatalogOf([
            { cveID: 'CVE-2024-0001', dateAdded: '2024-01-01' },
            { cveID: 'CVE-2024-0002', dateAdded: '2024-01-02' },
          ]),
        );

      await runWithKevReporting(useCase);

      expect(
        kevReportCalls(mockIssueRepository.createNewIssue.mock.calls),
      ).toHaveLength(1);
      expect(mockKevReportWatermarkRepository.save.mock.calls).toEqual([
        [
          {
            lastReportedDateAdded: '2024-01-02',
            reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0002'],
          },
        ],
      ]);
    });

    it('does not report an addition that the stored watermark already covers', async () => {
      const { useCase, mockIssueRepository, mockKevReportWatermarkRepository } =
        buildScanEnvironment(
          scannedExampleLibrary,
          kevCatalogOf([{ cveID: 'CVE-2024-0001', dateAdded: '2024-01-02' }]),
        );
      mockKevReportWatermarkRepository.load.mockResolvedValue({
        type: 'stored',
        watermark: {
          lastReportedDateAdded: '2024-01-02',
          reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0001'],
        },
      });

      await runWithKevReporting(useCase);

      expect(
        kevReportCalls(mockIssueRepository.createNewIssue.mock.calls),
      ).toHaveLength(0);
      expect(mockKevReportWatermarkRepository.save.mock.calls).toHaveLength(0);
    });

    it('reports an addition sharing the stored watermark date that was not reported before', async () => {
      const { useCase, mockIssueRepository, mockKevReportWatermarkRepository } =
        buildScanEnvironment(
          scannedExampleLibrary,
          kevCatalogOf([
            { cveID: 'CVE-2024-0001', dateAdded: '2024-01-02' },
            { cveID: 'CVE-2024-0002', dateAdded: '2024-01-02' },
          ]),
        );
      mockKevReportWatermarkRepository.load.mockResolvedValue({
        type: 'stored',
        watermark: {
          lastReportedDateAdded: '2024-01-02',
          reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0001'],
        },
      });

      await runWithKevReporting(useCase);

      const kevCalls = kevReportCalls(
        mockIssueRepository.createNewIssue.mock.calls,
      );
      expect(kevCalls).toHaveLength(1);
      expect(kevCalls[0][3]).toContain('CVE-2024-0002');
      expect(kevCalls[0][3]).not.toContain('CVE-2024-0001');
      expect(mockKevReportWatermarkRepository.save.mock.calls).toEqual([
        [
          {
            lastReportedDateAdded: '2024-01-02',
            reportedCveIdsOnLastReportedDateAdded: [
              'CVE-2024-0001',
              'CVE-2024-0002',
            ],
          },
        ],
      ]);
    });

    it('does not select an addition dated strictly before the stored watermark date', async () => {
      const { useCase, mockIssueRepository, mockKevReportWatermarkRepository } =
        buildScanEnvironment(
          scannedExampleLibrary,
          kevCatalogOf([{ cveID: 'CVE-2024-0001', dateAdded: '2024-01-01' }]),
        );
      mockKevReportWatermarkRepository.load.mockResolvedValue({
        type: 'stored',
        watermark: {
          lastReportedDateAdded: '2024-01-02',
          reportedCveIdsOnLastReportedDateAdded: [],
        },
      });

      await runWithKevReporting(useCase);

      expect(
        kevReportCalls(mockIssueRepository.createNewIssue.mock.calls),
      ).toHaveLength(0);
      expect(mockKevReportWatermarkRepository.save.mock.calls).toHaveLength(0);
    });

    it('advances the watermark over an addition that affects no scanned package so it is not weighed again', async () => {
      const { useCase, mockIssueRepository, mockKevReportWatermarkRepository } =
        buildScanEnvironment(
          scannedExampleLibrary,
          kevCatalogOf([{ cveID: 'CVE-2024-9999', dateAdded: '2024-01-02' }]),
        );

      await runWithKevReporting(useCase);

      expect(
        kevReportCalls(mockIssueRepository.createNewIssue.mock.calls),
      ).toHaveLength(0);
      expect(mockKevReportWatermarkRepository.save.mock.calls).toEqual([
        [
          {
            lastReportedDateAdded: '2024-01-02',
            reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-9999'],
          },
        ],
      ]);
    });

    it('skips the report and leaves the watermark untouched when the stored watermark is unreadable', async () => {
      const { useCase, mockIssueRepository, mockKevReportWatermarkRepository } =
        buildScanEnvironment(
          scannedExampleLibrary,
          kevCatalogOf([{ cveID: 'CVE-2024-0001', dateAdded: '2024-01-02' }]),
        );
      mockKevReportWatermarkRepository.load.mockResolvedValue({
        type: 'unreadable',
        reason: 'the stored watermark file holds malformed JSON',
      });
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await runWithKevReporting(useCase);

      expect(
        kevReportCalls(mockIssueRepository.createNewIssue.mock.calls),
      ).toHaveLength(0);
      expect(mockKevReportWatermarkRepository.save.mock.calls).toHaveLength(0);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'the stored watermark file holds malformed JSON',
        ),
      );
      errorSpy.mockRestore();
    });

    it('creates the report issue and logs when the watermark write fails, so the same additions are weighed again', async () => {
      const { useCase, mockIssueRepository, mockKevReportWatermarkRepository } =
        buildScanEnvironment(
          scannedExampleLibrary,
          kevCatalogOf([{ cveID: 'CVE-2024-0001', dateAdded: '2024-01-02' }]),
        );
      mockKevReportWatermarkRepository.save.mockRejectedValue(
        new Error('disk is read-only'),
      );
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await runWithKevReporting(useCase);

      expect(
        kevReportCalls(mockIssueRepository.createNewIssue.mock.calls),
      ).toHaveLength(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('disk is read-only'),
      );
      errorSpy.mockRestore();
    });
  });
});
