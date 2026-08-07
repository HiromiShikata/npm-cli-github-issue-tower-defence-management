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

      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockHttpRepository.get.mockResolvedValue(
        JSON.stringify({
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0001',
              vulnerabilityName: 'New Vulnerability',
              dateAdded: '2024-01-02',
            },
            {
              cveID: 'CVE-2023-9999',
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

    it('records the reported additions in the watermark after the issue is created', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockHttpRepository,
        mockKevReportWatermarkRepository,
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
              cveID: 'CVE-2024-0001',
              vulnerabilityName: 'First Vulnerability',
              dateAdded: '2024-01-01',
            },
            {
              cveID: 'CVE-2024-0002',
              vulnerabilityName: 'Second Vulnerability',
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

      expect(mockKevReportWatermarkRepository.save.mock.calls).toHaveLength(1);
      expect(mockKevReportWatermarkRepository.save.mock.calls[0][0]).toEqual({
        lastReportedDateAdded: '2024-01-02',
        reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0002'],
      });
    });

    it('does not report an addition that the stored watermark already covers', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockIssueRepository,
        mockHttpRepository,
        mockKevReportWatermarkRepository,
      } = buildUseCase();

      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockKevReportWatermarkRepository.load.mockResolvedValue({
        type: 'stored',
        watermark: {
          lastReportedDateAdded: '2024-01-02',
          reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0002'],
        },
      });
      mockHttpRepository.get.mockResolvedValue(
        JSON.stringify({
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0002',
              vulnerabilityName: 'Second Vulnerability',
              dateAdded: '2024-01-02',
            },
          ],
        }),
      );

      await useCase.run({
        targetDates: [new Date('2024-01-03T05:00:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
          enableKevNvdReport: true,
          kevReportRepo: 'security-reports',
        },
      });

      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
      expect(mockKevReportWatermarkRepository.save.mock.calls).toHaveLength(0);
    });

    it('reports only the additions dated after the stored watermark', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockIssueRepository,
        mockHttpRepository,
        mockKevReportWatermarkRepository,
      } = buildUseCase();

      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockKevReportWatermarkRepository.load.mockResolvedValue({
        type: 'stored',
        watermark: {
          lastReportedDateAdded: '2024-01-02',
          reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0002'],
        },
      });
      mockHttpRepository.get.mockResolvedValue(
        JSON.stringify({
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0002',
              vulnerabilityName: 'Second Vulnerability',
              dateAdded: '2024-01-02',
            },
            {
              cveID: 'CVE-2024-0003',
              vulnerabilityName: 'Third Vulnerability',
              dateAdded: '2024-01-03',
            },
          ],
        }),
      );

      await useCase.run({
        targetDates: [new Date('2024-01-03T05:00:00Z')],
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
      expect(mockIssueRepository.createNewIssue.mock.calls[0][2]).toBe(
        'CISA KEV new additions since 2024-01-02',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).toContain(
        'CVE-2024-0003',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).not.toContain(
        'CVE-2024-0002',
      );
      expect(mockKevReportWatermarkRepository.save.mock.calls[0][0]).toEqual({
        lastReportedDateAdded: '2024-01-03',
        reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0003'],
      });
    });

    it('reports an addition sharing the watermark date that was not reported before', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockIssueRepository,
        mockHttpRepository,
        mockKevReportWatermarkRepository,
      } = buildUseCase();

      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockKevReportWatermarkRepository.load.mockResolvedValue({
        type: 'stored',
        watermark: {
          lastReportedDateAdded: '2024-01-02',
          reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0002'],
        },
      });
      mockHttpRepository.get.mockResolvedValue(
        JSON.stringify({
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0002',
              vulnerabilityName: 'Second Vulnerability',
              dateAdded: '2024-01-02',
            },
            {
              cveID: 'CVE-2024-0009',
              vulnerabilityName: 'Late Same Day Vulnerability',
              dateAdded: '2024-01-02',
            },
          ],
        }),
      );

      await useCase.run({
        targetDates: [new Date('2024-01-03T05:00:00Z')],
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
        'CVE-2024-0009',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).not.toContain(
        'CVE-2024-0002',
      );
      expect(mockKevReportWatermarkRepository.save.mock.calls[0][0]).toEqual({
        lastReportedDateAdded: '2024-01-02',
        reportedCveIdsOnLastReportedDateAdded: [
          'CVE-2024-0002',
          'CVE-2024-0009',
        ],
      });
    });

    it('does not advance the watermark when the issue creation fails', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockIssueRepository,
        mockHttpRepository,
        mockKevReportWatermarkRepository,
      } = buildUseCase();

      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockKevReportWatermarkRepository.load.mockResolvedValue({
        type: 'stored',
        watermark: {
          lastReportedDateAdded: '2024-01-01',
          reportedCveIdsOnLastReportedDateAdded: [],
        },
      });
      mockHttpRepository.get.mockResolvedValue(
        JSON.stringify({
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0005',
              vulnerabilityName: 'Unreported Vulnerability',
              dateAdded: '2024-01-05',
            },
          ],
        }),
      );
      mockIssueRepository.createNewIssue.mockRejectedValue(
        new Error('issue creation failed'),
      );

      await expect(
        useCase.run({
          targetDates: [new Date('2024-01-10T05:00:00Z')],
          org: 'example-org',
          manager: 'manager-name',
          dailySecurityScan: {
            scanBaseDirectory: '/repos',
            targetHourUtc: 5,
            enableKevNvdReport: true,
            kevReportRepo: 'security-reports',
          },
        }),
      ).rejects.toThrow('issue creation failed');

      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.createNewIssue.mock.calls[0][2]).toBe(
        'CISA KEV new additions since 2024-01-01',
      );
      expect(mockKevReportWatermarkRepository.save.mock.calls).toHaveLength(0);
    });

    it('reports additions from the day before the last target date on the first run without a stored watermark', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockIssueRepository,
        mockHttpRepository,
        mockKevReportWatermarkRepository,
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
              vulnerabilityName: 'Old Vulnerability',
              dateAdded: '2023-12-31',
            },
            {
              cveID: 'CVE-2024-0001',
              vulnerabilityName: 'First Vulnerability',
              dateAdded: '2024-01-01',
            },
            {
              cveID: 'CVE-2024-0002',
              vulnerabilityName: 'Second Vulnerability',
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

      expect(mockKevReportWatermarkRepository.load.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.createNewIssue.mock.calls[0][2]).toBe(
        'CISA KEV new additions since 2024-01-01',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).toContain(
        'CVE-2024-0001',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).toContain(
        'CVE-2024-0002',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).not.toContain(
        'CVE-2023-9999',
      );
    });

    it('reports the same additions again on the next run when the watermark write fails after the issue was created', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockIssueRepository,
        mockHttpRepository,
        mockKevReportWatermarkRepository,
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
              cveID: 'CVE-2024-0002',
              vulnerabilityName: 'Second Vulnerability',
              dateAdded: '2024-01-02',
            },
          ],
        }),
      );
      mockKevReportWatermarkRepository.save.mockRejectedValue(
        new Error(
          "EACCES: permission denied, open '.cache/tdpm/kev-report-watermark.json'",
        ),
      );
      const errorLog = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const input = {
        targetDates: [new Date('2024-01-02T05:00:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
          enableKevNvdReport: true,
          kevReportRepo: 'security-reports',
        },
      };

      await expect(useCase.run(input)).resolves.toBeUndefined();

      const loggedMessages = errorLog.mock.calls.map((call) => String(call[0]));
      expect(
        loggedMessages.some(
          (message) =>
            message.includes('kev-report-watermark.json') &&
            message.includes('EACCES: permission denied') &&
            message.includes('reported again on the next run'),
        ),
      ).toBe(true);

      await expect(
        useCase.run({
          ...input,
          targetDates: [new Date('2024-01-03T05:00:00Z')],
        }),
      ).resolves.toBeUndefined();

      errorLog.mockRestore();

      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(2);
      expect(mockIssueRepository.createNewIssue.mock.calls[1][3]).toBe(
        mockIssueRepository.createNewIssue.mock.calls[0][3],
      );
      expect(mockKevReportWatermarkRepository.save.mock.calls).toHaveLength(2);
      expect(mockKevReportWatermarkRepository.save.mock.calls[1][0]).toEqual(
        mockKevReportWatermarkRepository.save.mock.calls[0][0],
      );
    });

    it('does not select an addition dated strictly before the stored watermark date', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockIssueRepository,
        mockHttpRepository,
        mockKevReportWatermarkRepository,
      } = buildUseCase();

      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockKevReportWatermarkRepository.load.mockResolvedValue({
        type: 'stored',
        watermark: {
          lastReportedDateAdded: '2024-01-05',
          reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0005'],
        },
      });
      mockHttpRepository.get.mockResolvedValue(
        JSON.stringify({
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0003',
              vulnerabilityName: 'Back Dated Vulnerability',
              dateAdded: '2024-01-03',
            },
          ],
        }),
      );

      await useCase.run({
        targetDates: [new Date('2024-01-04T05:00:00Z')],
        org: 'example-org',
        manager: 'manager-name',
        dailySecurityScan: {
          scanBaseDirectory: '/repos',
          targetHourUtc: 5,
          enableKevNvdReport: true,
          kevReportRepo: 'security-reports',
        },
      });

      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
      expect(mockKevReportWatermarkRepository.save.mock.calls).toHaveLength(0);
    });

    it('skips the report and leaves the watermark untouched when the stored watermark is unreadable', async () => {
      const {
        useCase,
        mockLocalCommandRunner,
        mockIssueRepository,
        mockHttpRepository,
        mockKevReportWatermarkRepository,
      } = buildUseCase();

      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockKevReportWatermarkRepository.load.mockResolvedValue({
        type: 'unreadable',
        reason: 'the stored watermark file does not contain valid JSON',
      });
      mockHttpRepository.get.mockResolvedValue(
        JSON.stringify({
          vulnerabilities: [
            {
              cveID: 'CVE-2024-0002',
              vulnerabilityName: 'Second Vulnerability',
              dateAdded: '2024-01-02',
            },
          ],
        }),
      );
      const errorLog = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

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

      const loggedMessages = errorLog.mock.calls.map((call) => String(call[0]));
      errorLog.mockRestore();

      expect(
        loggedMessages.some(
          (message) =>
            message.includes(
              'the stored watermark file does not contain valid JSON',
            ) && message.includes('unchanged'),
        ),
      ).toBe(true);
      expect(mockHttpRepository.get.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
      expect(mockKevReportWatermarkRepository.save.mock.calls).toHaveLength(0);
    });
  });
});
