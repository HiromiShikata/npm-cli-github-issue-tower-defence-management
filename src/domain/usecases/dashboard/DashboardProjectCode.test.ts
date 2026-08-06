import {
  DASHBOARD_DISPLAY_LABEL_LENGTH,
  assertDashboardDisplayLabelsUnique,
  toDashboardDisplayLabel,
} from './DashboardProjectCode';

describe('DashboardProjectCode', () => {
  it('derives the display label from the leading characters of the project name', () => {
    expect(DASHBOARD_DISPLAY_LABEL_LENGTH).toBe(2);
    expect(toDashboardDisplayLabel('acme')).toBe('ac');
    expect(toDashboardDisplayLabel('globex')).toBe('gl');
    expect(toDashboardDisplayLabel('initech')).toBe('in');
  });

  it('throws for a project name shorter than the display label rather than padding it', () => {
    expect(() => toDashboardDisplayLabel('a')).toThrow(
      'Dashboard project name is shorter than the 2-character display label: a',
    );
  });

  it('accepts project names whose derived display labels are all distinct', () => {
    expect(() =>
      assertDashboardDisplayLabelsUnique(['acme', 'globex', 'initech']),
    ).not.toThrow();
  });

  it('throws when two project names derive the same display label', () => {
    expect(() =>
      assertDashboardDisplayLabelsUnique(['acme', 'acmelabs']),
    ).toThrow(
      'Dashboard project names acme and acmelabs share the display label ac',
    );
  });
});
