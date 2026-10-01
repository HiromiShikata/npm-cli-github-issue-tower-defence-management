import { workerRequestTextOf } from './WorkerRequestText';

describe('workerRequestTextOf', () => {
  const testCases: {
    name: string;
    issueUrl: string;
    expectedWorkerRequestText: string;
  }[] = [
    {
      name: 'issue URL',
      issueUrl: 'https://github.com/octo/repo/issues/12',
      expectedWorkerRequestText:
        'Take ownership of https://github.com/octo/repo/issues/12',
    },
    {
      name: 'pull request URL',
      issueUrl: 'https://github.com/octo/repo/pull/34',
      expectedWorkerRequestText:
        'Take ownership of https://github.com/octo/repo/pull/34',
    },
    {
      name: 'issue URL of another owner and a repository name with dashes and dots',
      issueUrl: 'https://github.com/another-owner/tool.config-files/issues/1',
      expectedWorkerRequestText:
        'Take ownership of https://github.com/another-owner/tool.config-files/issues/1',
    },
    {
      name: 'issue URL with a large issue number',
      issueUrl: 'https://github.com/Example-Org/Mixed_Case/issues/987654',
      expectedWorkerRequestText:
        'Take ownership of https://github.com/Example-Org/Mixed_Case/issues/987654',
    },
  ];

  it.each(testCases)(
    'returns the Take ownership sentence without the ultracode keyword for $name',
    ({ issueUrl, expectedWorkerRequestText }) => {
      const workerRequestText = workerRequestTextOf(issueUrl);

      expect(workerRequestText).toBe(expectedWorkerRequestText);
      expect(workerRequestText).not.toContain('ultracode');
    },
  );
});
