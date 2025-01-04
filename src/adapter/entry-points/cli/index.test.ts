import { execSync } from 'child_process';

describe('commander program', () => {
  it('should output help contents', () => {
    const output = execSync(
      'npx ts-node ./src/adapter/entry-points/cli/index.ts -h',
    ).toString();

    expect(output.trim())
      .toEqual(`Usage: github-issue-tower-defence-management [options]

CLI tool for GitHub Issue Tower Defence Management

Options:
  -t, --trigger <type>  Trigger type: issue or schedule
  -c, --config <path>   Path to config YAML file
  -v, --verbose         Verbose output
  -i, --issue <url>     GitHub Issue URL
  -h, --help            display help for command`);
  });
});
