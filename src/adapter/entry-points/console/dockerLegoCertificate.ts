import * as path from 'path';
import { spawn } from 'child_process';

export const LEGO_DOCKER_IMAGE = 'goacme/lego:v5.7.0';
export const CERTIFICATE_RENEWAL_THRESHOLD_DAYS = 3;
export const CERTIFICATE_RENEWAL_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const LETS_ENCRYPT_STAGING_DIRECTORY_URL =
  'https://acme-staging-v02.api.letsencrypt.org/directory';
export const LETS_ENCRYPT_PRODUCTION_DIRECTORY_URL =
  'https://acme-v02.api.letsencrypt.org/directory';

export type CertificateAcquisitionMode = 'obtain' | 'renew';
export type LegoDockerArguments = {
  mode: CertificateAcquisitionMode;
  acmeDataDirectory: string;
  acmeServerUrl: string;
  acmeIpAddress: string;
  hostUserId: number;
  hostGroupId: number;
};

export const buildLegoDockerArgs = (input: LegoDockerArguments): string[] => [
  'run',
  '--rm',
  '--network',
  'host',
  '-v',
  `${input.acmeDataDirectory}:/.lego`,
  LEGO_DOCKER_IMAGE,
  'run',
  '--accept-tos',
  '--server',
  input.acmeServerUrl,
  '--domains',
  input.acmeIpAddress,
  '--http',
  '--profile',
  'shortlived',
  '--path',
  '/.lego',
  ...(input.mode === 'renew'
    ? ['--renew-days', String(CERTIFICATE_RENEWAL_THRESHOLD_DAYS)]
    : []),
];

export type LegoChownDockerArguments = {
  acmeDataDirectory: string;
  hostUserId: number;
  hostGroupId: number;
};

export const buildLegoChownDockerArgs = (
  input: LegoChownDockerArguments,
): string[] => [
  'run',
  '--rm',
  '-v',
  `${input.acmeDataDirectory}:/.lego`,
  '--entrypoint',
  'chown',
  LEGO_DOCKER_IMAGE,
  '-R',
  `${input.hostUserId}:${input.hostGroupId}`,
  '/.lego',
];

export const selectCertificateAcquisitionMode = (
  certificateFilesPresent: boolean,
): CertificateAcquisitionMode => (certificateFilesPresent ? 'renew' : 'obtain');

export const certificateFilePaths = (
  acmeDataDirectory: string,
  acmeIpAddress: string,
): { certificatePath: string; keyPath: string } => ({
  certificatePath: path.join(
    acmeDataDirectory,
    'certificates',
    `${acmeIpAddress}.crt`,
  ),
  keyPath: path.join(acmeDataDirectory, 'certificates', `${acmeIpAddress}.key`),
});

export const shouldScheduleCertificateRenewal = (input: {
  httpsPort?: number;
  acmeIpAddress?: string;
}): boolean =>
  input.httpsPort !== undefined && input.acmeIpAddress !== undefined;

export const isIpv4Address = (value: string): boolean => {
  const segments = value.split('.');
  return (
    segments.length === 4 &&
    segments.every(
      (segment) =>
        /^(0|[1-9][0-9]{0,2})$/.test(segment) && Number(segment) <= 255,
    )
  );
};

export type LegoCommandResult = { exitCode: number; output: string };
export const runDockerLegoCommand = (
  args: string[],
): Promise<LegoCommandResult> =>
  new Promise((resolve) => {
    const child = spawn('docker', args);
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('error', (error: Error) =>
      resolve({ exitCode: 1, output: `${output}${error.message}` }),
    );
    child.on('close', (exitCode: number | null) =>
      resolve({ exitCode: exitCode ?? 1, output }),
    );
  });
