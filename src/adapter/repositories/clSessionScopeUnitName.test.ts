import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { toTmuxSessionName } from '../../domain/usecases/intmux/InTmuxByHumanSessionReconcileUseCase';
import { clSessionScopeUnitName } from './clSessionScopeUnitName';

const issueUrls = [
  'https://github.com/HiromiShikata/secretary/issues/1261',
  'https://github.com/owner/repo/issues/9',
  'https://github.com/owner/repo/pull/42',
];

const sessionNames = [
  ...issueUrls,
  ...issueUrls.map((url) => toTmuxSessionName(url)),
  'idle_no_task_session',
  'plain-session',
  'ALLCAPS123',
];

const canonicalScopeLibPath = (): string | null => {
  const explicitPath = process.env.CL_SCOPE_LIB_PATH;
  if (explicitPath !== undefined && existsSync(explicitPath)) {
    return explicitPath;
  }
  const defaultPath = join(
    homedir(),
    'git',
    'secretary',
    'machine',
    'sk',
    'sh',
    'cl-scope-lib.sh',
  );
  return existsSync(defaultPath) ? defaultPath : null;
};

describe('clSessionScopeUnitName cross-component contract', () => {
  it('derives a systemd-safe scope unit name of the form cl-<safe>.scope for every session form', () => {
    for (const sessionName of sessionNames) {
      const unitName = clSessionScopeUnitName(sessionName);
      expect(unitName.startsWith('cl-')).toBe(true);
      expect(unitName.endsWith('.scope')).toBe(true);
      const core = unitName.slice(0, -'.scope'.length);
      expect(/^[A-Za-z0-9._-]+$/.test(core)).toBe(true);
    }
  });

  it('collapses a raw issue URL and its tmux-normalized session name to the same scope unit name', () => {
    for (const url of issueUrls) {
      expect(clSessionScopeUnitName(toTmuxSessionName(url))).toBe(
        clSessionScopeUnitName(url),
      );
    }
  });

  const libPath = canonicalScopeLibPath();
  const canonicalContractTest = libPath === null ? it.skip : it;
  canonicalContractTest(
    'matches the canonical cl_scope_unit_name derivation shared with cl',
    () => {
      if (libPath === null) {
        return;
      }
      for (const sessionName of sessionNames) {
        const canonicalUnitName = execFileSync(
          'bash',
          [libPath, 'unit-name', sessionName],
          { encoding: 'utf8' },
        );
        expect(clSessionScopeUnitName(sessionName)).toBe(canonicalUnitName);
      }
    },
  );
});
