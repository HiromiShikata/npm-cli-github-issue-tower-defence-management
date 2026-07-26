import {
  DASHBOARD_DISPLAY_LABEL_BY_PROJECT_NAME,
  DASHBOARD_PROJECT_NAMES,
  toDashboardDisplayLabel,
} from './DashboardProjectCode';

describe('DashboardProjectCode', () => {
  it('maps each full project name to its 2-char display label', () => {
    expect(toDashboardDisplayLabel('umino')).toBe('um');
    expect(toDashboardDisplayLabel('xmile')).toBe('xm');
    expect(toDashboardDisplayLabel('xcare')).toBe('xc');
    expect(toDashboardDisplayLabel('utage3')).toBe('ut');
  });

  it('exposes the project names in the same order as the label mapping', () => {
    expect(DASHBOARD_PROJECT_NAMES).toEqual([
      'umino',
      'xmile',
      'xcare',
      'utage3',
    ]);
    expect(DASHBOARD_PROJECT_NAMES).toEqual(
      Object.keys(DASHBOARD_DISPLAY_LABEL_BY_PROJECT_NAME),
    );
  });

  it('throws for an unknown project name rather than guessing a label', () => {
    expect(() => toDashboardDisplayLabel('unknown')).toThrow(
      'Unknown dashboard project name: unknown',
    );
  });
});
