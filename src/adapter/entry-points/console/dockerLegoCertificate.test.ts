import * as path from 'path';
import { EventEmitter } from 'events';

type FakeChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
};

const spawnCalls: unknown[][] = [];
let spawnReturnValue: FakeChild;

jest.mock('child_process', () => ({
  spawn: (...args: unknown[]): FakeChild => {
    spawnCalls.push(args);
    return spawnReturnValue;
  },
}));

import {
  buildLegoDockerArgs,
  CERTIFICATE_RENEWAL_INTERVAL_MS,
  CERTIFICATE_RENEWAL_THRESHOLD_DAYS,
  LEGO_DOCKER_IMAGE,
  LETS_ENCRYPT_STAGING_DIRECTORY_URL,
  LETS_ENCRYPT_PRODUCTION_DIRECTORY_URL,
  certificateFilePaths,
  isIpv4Address,
  selectCertificateAcquisitionMode,
  shouldScheduleCertificateRenewal,
  runDockerLegoCommand,
} from './dockerLegoCertificate';

const createFakeChild = (): FakeChild =>
  Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
  });

describe('docker lego certificate', () => {
  beforeEach(() => {
    spawnCalls.length = 0;
    spawnReturnValue = createFakeChild();
  });

  it('exports the certificate acquisition constants', () => {
    expect(LEGO_DOCKER_IMAGE).toBe('goacme/lego:v5.7.0');
    expect(CERTIFICATE_RENEWAL_THRESHOLD_DAYS).toBe(3);
    expect(CERTIFICATE_RENEWAL_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
    expect(LETS_ENCRYPT_PRODUCTION_DIRECTORY_URL).toBe(
      'https://acme-v02.api.letsencrypt.org/directory',
    );
    expect(LETS_ENCRYPT_STAGING_DIRECTORY_URL).toBe(
      'https://acme-staging-v02.api.letsencrypt.org/directory',
    );
  });

  it('builds the obtain and renew docker argument vectors', () => {
    const input = {
      acmeDataDirectory: '/var/cache/tdpm/acme',
      acmeServerUrl: 'https://acme-staging-v02.api.letsencrypt.org/directory',
      acmeIpAddress: '50.30.32.53',
      hostUserId: 1000,
      hostGroupId: 1000,
    };
    const baseArguments = [
      'run',
      '--rm',
      '--user',
      '1000:1000',
      '-p',
      '80:80',
      '-v',
      '/var/cache/tdpm/acme:/.lego',
      'goacme/lego:v5.7.0',
      'run',
      '--accept-tos',
      '--server',
      'https://acme-staging-v02.api.letsencrypt.org/directory',
      '--domains',
      '50.30.32.53',
      '--http',
      '--profile',
      'shortlived',
      '--path',
      '/.lego',
    ];
    expect(buildLegoDockerArgs({ mode: 'obtain', ...input })).toEqual(
      baseArguments,
    );
    expect(buildLegoDockerArgs({ mode: 'renew', ...input })).toEqual([
      ...baseArguments,
      '--renew-days',
      '3',
    ]);
  });

  it.each([
    {
      name: 'stdout only',
      stdout: 'stdout line',
      stderr: '',
      output: 'stdout line',
    },
    {
      name: 'stderr only',
      stdout: '',
      stderr: 'stderr line',
      output: 'stderr line',
    },
    {
      name: 'stdout and stderr',
      stdout: 'stdout line',
      stderr: 'stderr line',
      output: 'stdout linestderr line',
    },
  ])(
    'returns the full output for $name',
    async ({ stdout, stderr, output }) => {
      const child = spawnReturnValue;
      const resultPromise = runDockerLegoCommand(['run']);
      child.stdout?.emit('data', Buffer.from(stdout));
      child.stderr?.emit('data', Buffer.from(stderr));
      child.emit('close', 1);

      await expect(resultPromise).resolves.toEqual({ exitCode: 1, output });
      expect(spawnCalls).toEqual([['docker', ['run']]]);
    },
  );

  it('returns spawn errors as command output', async () => {
    const child = spawnReturnValue;
    const resultPromise = runDockerLegoCommand(['run']);
    child.emit('error', new Error('spawn failed'));

    await expect(resultPromise).resolves.toEqual({
      exitCode: 1,
      output: 'spawn failed',
    });
  });

  it.each([
    { certificateFilesPresent: true, expected: 'renew' },
    { certificateFilesPresent: false, expected: 'obtain' },
  ])(
    'selects $expected when certificate files present is $certificateFilesPresent',
    ({ certificateFilesPresent, expected }) => {
      expect(selectCertificateAcquisitionMode(certificateFilesPresent)).toBe(
        expected,
      );
    },
  );

  it('builds certificate and key paths from the ACME directory and IP address', () => {
    expect(certificateFilePaths('/var/cache/tdpm/acme', '50.30.32.53')).toEqual(
      {
        certificatePath: path.join(
          '/var/cache/tdpm/acme',
          'certificates',
          '50.30.32.53.crt',
        ),
        keyPath: path.join(
          '/var/cache/tdpm/acme',
          'certificates',
          '50.30.32.53.key',
        ),
      },
    );
  });

  it.each([
    { input: {}, expected: false },
    { input: { httpsPort: 8443 }, expected: false },
    { input: { acmeIpAddress: '127.0.0.1' }, expected: false },
    { input: { httpsPort: 8443, acmeIpAddress: '127.0.0.1' }, expected: true },
  ])(
    'schedules renewal only when HTTPS port and ACME IP are both defined',
    ({ input, expected }) => {
      expect(shouldScheduleCertificateRenewal(input)).toBe(expected);
    },
  );

  it.each([
    { value: '0.0.0.0', expected: true },
    { value: '127.0.0.1', expected: true },
    { value: '255.255.255.255', expected: true },
    { value: '01.2.3.4', expected: false },
    { value: '1.02.3.4', expected: false },
    { value: '1.2.3.04', expected: false },
    { value: '256.0.0.1', expected: false },
    { value: '-1.0.0.1', expected: false },
    { value: '1.2.3', expected: false },
    { value: '1.2.3.4.5', expected: false },
    { value: '1.2.3.a', expected: false },
    { value: '', expected: false },
  ])('validates IPv4 address $value as $expected', ({ value, expected }) => {
    expect(isIpv4Address(value)).toBe(expected);
  });
});
