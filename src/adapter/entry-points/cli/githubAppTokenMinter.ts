import * as fs from 'fs';
import * as crypto from 'crypto';
import ky from 'ky';

type Installation = {
  id: number;
  account: { login: string };
};

type AccessTokenResponse = {
  token?: string;
};

const createRs256Jwt = (privateKeyPem: Buffer, clientId: string): string => {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 600, iss: clientId }),
  ).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(privateKeyPem).toString('base64url');
  return `${signingInput}.${signature}`;
};

const GITHUB_API_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

export const mintTokenFromKeyPath = async (
  keyPath: string,
  installationAccount: string,
): Promise<string | null> => {
  try {
    const privateKeyPem = fs.readFileSync(keyPath);
    const configPath = keyPath.replace(/-private-key\.pem$/, '.json');
    const configRaw = fs.readFileSync(configPath, 'utf-8');
    const config: unknown = JSON.parse(configRaw);
    if (
      typeof config !== 'object' ||
      config === null ||
      !('client_id' in config)
    ) {
      return null;
    }
    const clientId = (config as { client_id: unknown }).client_id;
    if (typeof clientId !== 'string' || !clientId) {
      return null;
    }

    const jwt = createRs256Jwt(privateKeyPem, clientId);

    const installations = await ky
      .get('https://api.github.com/app/installations', {
        headers: {
          ...GITHUB_API_HEADERS,
          Authorization: `Bearer ${jwt}`,
        },
      })
      .json<Installation[]>();

    const target = installations.find(
      (i) => i.account.login === installationAccount,
    );
    if (!target) {
      return null;
    }

    const tokenResponse = await ky
      .post(
        `https://api.github.com/app/installations/${target.id}/access_tokens`,
        {
          headers: {
            ...GITHUB_API_HEADERS,
            Authorization: `Bearer ${jwt}`,
          },
          json: {
            permissions: {
              contents: 'read',
              issues: 'read',
              metadata: 'read',
              pull_requests: 'read',
            },
          },
        },
      )
      .json<AccessTokenResponse>();

    return tokenResponse.token ?? null;
  } catch {
    return null;
  }
};

export const mintReadOnlyTokensFromKeyPaths = async (
  keyPaths: string[],
  installationAccount = 'HiromiShikata',
  mintFn: (
    keyPath: string,
    account: string,
  ) => Promise<string | null> = mintTokenFromKeyPath,
): Promise<string[]> => {
  const tokens: string[] = [];
  for (const keyPath of keyPaths) {
    const token = await mintFn(keyPath, installationAccount);
    if (token !== null) {
      tokens.push(token);
    }
  }
  return tokens;
};
