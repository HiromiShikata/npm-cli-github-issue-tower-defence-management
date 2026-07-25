import { clSessionScopeUnitNameFromCgroupContent } from './clSessionScopeUnitNameFromCgroupContent';

describe('clSessionScopeUnitNameFromCgroupContent', () => {
  it('extracts the cl-*.scope unit from a cgroup v2 single-hierarchy line', () => {
    const cgroupContent =
      '0::/user.slice/user-1000.slice/user@1000.service/app.slice/cl-https---github-com-owner-repo-issues-9.scope\n';

    const result = clSessionScopeUnitNameFromCgroupContent(cgroupContent);

    expect(result).toBe('cl-https---github-com-owner-repo-issues-9.scope');
  });

  it('extracts the cl-*.scope unit from a multi-hierarchy cgroup v1 file', () => {
    const cgroupContent = [
      '12:pids:/user.slice/user-1000.slice/user@1000.service/app.slice/cl-leader-session.scope',
      '11:cpu,cpuacct:/user.slice/user-1000.slice/user@1000.service/app.slice/cl-leader-session.scope',
      '0::/user.slice/user-1000.slice/user@1000.service/app.slice/cl-leader-session.scope',
      '',
    ].join('\n');

    const result = clSessionScopeUnitNameFromCgroupContent(cgroupContent);

    expect(result).toBe('cl-leader-session.scope');
  });

  it('returns null when no cl-*.scope unit is present', () => {
    const cgroupContent =
      '0::/user.slice/user-1000.slice/user@1000.service/app.slice/vte-spawn-abc.scope\n';

    const result = clSessionScopeUnitNameFromCgroupContent(cgroupContent);

    expect(result).toBeNull();
  });
});
