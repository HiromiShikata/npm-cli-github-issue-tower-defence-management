import { buildWorkflowIncidentReportUrl } from './workflowIncidentReport';

describe('buildWorkflowIncidentReportUrl', () => {
  it('appends body param with encoded reference URL when base URL has no query params', () => {
    const base = 'https://github.com/owner/repo/issues/new';
    const ref = 'https://github.com/owner/repo/issues/123';
    const result = buildWorkflowIncidentReportUrl(base, ref);
    expect(result).toBe(
      `${base}?body=${encodeURIComponent(`Related: ${ref}`)}`,
    );
  });

  it('appends body param with & separator when base URL already has query params', () => {
    const base = 'https://github.com/owner/repo/issues/new?template=bug.md';
    const ref = 'https://github.com/owner/repo/issues/456';
    const result = buildWorkflowIncidentReportUrl(base, ref);
    expect(result).toBe(
      `${base}&body=${encodeURIComponent(`Related: ${ref}`)}`,
    );
  });

  it('encodes comment anchor URLs correctly', () => {
    const base = 'https://github.com/owner/repo/issues/new';
    const ref = 'https://github.com/owner/repo/issues/123#issuecomment-9876543';
    const result = buildWorkflowIncidentReportUrl(base, ref);
    expect(result).toContain(encodeURIComponent(ref));
  });
});
