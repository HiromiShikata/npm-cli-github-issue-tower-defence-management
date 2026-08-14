import { parseAllDocuments } from 'yaml';
import {
  OWNER_CALL_FILE_DIRECTORY_NAME,
  OWNER_CALL_FILE_PROJECT_CODE_FOR_NO_PROJECT,
  isOwnerCallCalledAtValid,
  ownerCallFileRelativePath,
  ownerCallYamlDocument,
} from './OwnerCallFile';
import { toTmuxSessionName } from './InTmuxByHumanSessionReconcileUseCase';

describe('ownerCallFileRelativePath', () => {
  it('places the file under the owner call directory of the given project code', () => {
    expect(ownerCallFileRelativePath('umino', 'secretary')).toBe(
      'call-to-user/umino/secretary.yaml',
    );
  });

  it('replaces every slash of the session name with an underscore', () => {
    expect(
      ownerCallFileRelativePath(
        'umino',
        toTmuxSessionName('https://github.com/OWNER/REPO/issues/1'),
      ),
    ).toBe('call-to-user/umino/https___github_com_OWNER_REPO_issues_1.yaml');
  });

  it('uses NA for a session that belongs to no project', () => {
    expect(ownerCallFileRelativePath(null, 'app')).toBe(
      'call-to-user/NA/app.yaml',
    );
    expect(
      ownerCallFileRelativePath(
        OWNER_CALL_FILE_PROJECT_CODE_FOR_NO_PROJECT,
        'app',
      ),
    ).toBe('call-to-user/NA/app.yaml');
  });

  it('starts with the owner call directory name every reader resolves against', () => {
    expect(
      ownerCallFileRelativePath('umino', 'secretary').startsWith(
        `${OWNER_CALL_FILE_DIRECTORY_NAME}/`,
      ),
    ).toBe(true);
  });
});

describe('isOwnerCallCalledAtValid', () => {
  it('accepts a UTC ISO-8601 timestamp with second precision and a trailing Z', () => {
    expect(isOwnerCallCalledAtValid('2026-08-14T04:22:28Z')).toBe(true);
  });

  it('rejects a timestamp without second precision, without the Z, or with a numeric offset', () => {
    expect(isOwnerCallCalledAtValid('2026-08-14T04:22Z')).toBe(false);
    expect(isOwnerCallCalledAtValid('2026-08-14T04:22:28')).toBe(false);
    expect(isOwnerCallCalledAtValid('2026-08-14T04:22:28+09:00')).toBe(false);
    expect(isOwnerCallCalledAtValid('2026-08-14T04:22:28.123Z')).toBe(false);
    expect(isOwnerCallCalledAtValid('')).toBe(false);
  });

  it('rejects a timestamp whose calendar fields do not denote a real instant', () => {
    expect(isOwnerCallCalledAtValid('2026-13-14T04:22:28Z')).toBe(false);
  });
});

describe('ownerCallYamlDocument', () => {
  const sessionName = toTmuxSessionName(
    'https://github.com/OWNER/REPO/issues/1',
  );

  it('renders one YAML document opened by the YAML document delimiter', () => {
    expect(
      ownerCallYamlDocument({
        sessionName,
        calledAt: '2026-08-14T04:22:28Z',
        body: 'The first line of the call body.\n\nA later line of the call body.\n',
      }),
    ).toBe(
      [
        '---',
        'sessionName: "https_//github_com/OWNER/REPO/issues/1"',
        'calledAt: "2026-08-14T04:22:28Z"',
        'body: |2',
        '  The first line of the call body.',
        '',
        '  A later line of the call body.',
        '',
      ].join('\n'),
    );
  });

  it('keeps a body whose first line begins with a space readable as YAML', () => {
    const body = '  indented first line\nsecond line\n';
    const document = ownerCallYamlDocument({
      sessionName,
      calledAt: '2026-08-14T04:22:28Z',
      body,
    });

    const parsed = parseAllDocuments(document);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].errors).toEqual([]);
    expect(parsed[0].toJS()).toEqual({
      sessionName,
      calledAt: '2026-08-14T04:22:28Z',
      body,
    });
  });

  it('keeps a body line that would otherwise open a new YAML document inside the block', () => {
    const body = '---\nnot a document delimiter\n';
    const parsed = parseAllDocuments(
      ownerCallYamlDocument({
        sessionName,
        calledAt: '2026-08-14T04:22:28Z',
        body,
      }),
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0].toJS()).toEqual({
      sessionName,
      calledAt: '2026-08-14T04:22:28Z',
      body,
    });
  });

  it('repeats the session name in the document so a reader can reject a foreign file', () => {
    const parsed = parseAllDocuments(
      ownerCallYamlDocument({
        sessionName,
        calledAt: '2026-08-14T04:22:28Z',
        body: 'one line\n',
      }),
    );

    expect(parsed[0].toJS()).toEqual({
      sessionName,
      calledAt: '2026-08-14T04:22:28Z',
      body: 'one line\n',
    });
  });
});
