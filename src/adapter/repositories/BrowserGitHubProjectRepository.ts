import { createHmac } from 'crypto';
import { chromium } from 'playwright';
import { Project } from '../../domain/entities/Project';
import { StatusDefaultRepository } from '../../domain/usecases/adapter-interfaces/StatusDefaultRepository';
import { projectLocationFromUrl } from './RestProjectRepository';

const generateTotp = (secret: string): string => {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const secretUpper = secret.toUpperCase().replace(/=+$/, '');
  let bytes = 0n;
  let bitsLeft = 0;
  const output: number[] = [];
  for (const char of secretUpper) {
    const val = base32Chars.indexOf(char);
    if (val === -1) continue;
    bytes = (bytes << 5n) | BigInt(val);
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      output.push(Number((bytes >> BigInt(bitsLeft)) & 0xffn));
      bytes &= (1n << BigInt(bitsLeft)) - 1n;
    }
  }
  const key = Buffer.from(output);
  const counter = BigInt(Math.floor(Date.now() / 1000 / 30));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
};

export class BrowserGitHubProjectRepository implements Pick<
  StatusDefaultRepository,
  'setStatusFieldDefault'
> {
  constructor(
    private readonly username: string | undefined,
    private readonly password: string | undefined,
    private readonly totpSecret: string | undefined,
  ) {}

  setStatusFieldDefault = async (
    project: Project,
    optionId: string,
  ): Promise<void> => {
    const location = projectLocationFromUrl(project.url);
    if (!location) {
      throw new Error(
        `BrowserGitHubProjectRepository: cannot parse project URL: ${project.url}`,
      );
    }

    const settingsUrl = `https://github.com/${location.ownerType}/${location.owner}/projects/${location.projectNumber}/settings/fields/Status`;

    if (!this.username || !this.password) {
      console.warn(
        `BrowserGitHubProjectRepository: GITHUB_USERNAME or GITHUB_PASSWORD is unset; skipping setStatusFieldDefault. Settings URL: ${settingsUrl}`,
      );
      return;
    }

    const optionName = project.status.statuses.find(
      (s) => s.id === optionId,
    )?.name;
    if (!optionName) {
      throw new Error(
        `BrowserGitHubProjectRepository: option with id "${optionId}" not found in project status list`,
      );
    }

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();

      await page.goto('https://github.com/login');
      await page.fill('#login_field', this.username);
      await page.fill('#password', this.password);
      await page.click('[name="commit"]');

      const otpInput = page.locator('#app_totp');
      const isOtpVisible = await otpInput.isVisible().catch(() => false);
      if (isOtpVisible && this.totpSecret) {
        const totp = generateTotp(this.totpSecret);
        await otpInput.fill(totp);
        await page.click('[type="submit"]');
      }

      await page.goto(settingsUrl);

      const defaultSelect = page
        .locator('select[aria-label="Default value"]')
        .first();
      await defaultSelect.waitFor({ state: 'visible' });
      const options = await defaultSelect.locator('option').allTextContents();
      const matchingOption = options.find((o) => o.trim() === optionName);
      if (!matchingOption) {
        throw new Error(
          `BrowserGitHubProjectRepository: option "${optionName}" not found in Default dropdown. Available: ${options.join(', ')}`,
        );
      }
      await defaultSelect.selectOption({ label: optionName });

      const saveButton = page
        .locator('button[type="submit"]')
        .filter({ hasText: /save/i })
        .first();
      await saveButton.click();
    } finally {
      await browser.close();
    }
  };
}
