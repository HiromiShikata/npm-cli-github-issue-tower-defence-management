import { spawnSync } from 'child_process';
import * as path from 'path';

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');
const scriptPath = path.join(repositoryRoot, 'scripts', 'sanitizePrNumber.sh');

const rateLimitErrorResponseBody = `{
  "message": "API rate limit exceeded for user ID 6440811. (But here's the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)",
  "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
  "status": "403"
}`;

type SanitizePrNumberCase = {
  readonly description: string;
  readonly rawValue: string;
  readonly expectedStdout: string;
};

const cases: ReadonlyArray<SanitizePrNumberCase> = [
  {
    description: 'a valid single-digit PR number',
    rawValue: '7',
    expectedStdout: '7',
  },
  {
    description: 'a valid multi-digit PR number',
    rawValue: '1234',
    expectedStdout: '1234',
  },
  {
    description: 'an empty string',
    rawValue: '',
    expectedStdout: '',
  },
  {
    description:
      'the exact multi-line rate-limit error body returned by gh api',
    rawValue: rateLimitErrorResponseBody,
    expectedStdout: '',
  },
  {
    description: 'arbitrary non-numeric garbage',
    rawValue: 'abc',
    expectedStdout: '',
  },
  {
    description: 'a value mixing digits and non-digits',
    rawValue: '12abc',
    expectedStdout: '',
  },
];

describe('sanitizePrNumber.sh', () => {
  it.each(cases)(
    'prints "$expectedStdout" and exits 0 for $description',
    ({ rawValue, expectedStdout }) => {
      const result = spawnSync('bash', [scriptPath, rawValue], {
        encoding: 'utf8',
      });

      expect(result.stdout).toBe(expectedStdout);
      expect(result.status).toBe(0);
    },
  );
});
