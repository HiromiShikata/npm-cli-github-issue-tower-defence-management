import {
  DASHBOARD_DISPLAY_LABEL_LENGTH,
  assignDashboardDisplayLabels,
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

  describe('assignDashboardDisplayLabels', () => {
    it('assigns the labels of a list and keeps every label distinct', () => {
      const cases: { projectNames: string[]; labels: string[] }[] = [
        {
          projectNames: ['acme', 'globex', 'initech'],
          labels: ['ac', 'gl', 'in'],
        },
        { projectNames: ['acme', 'acmetools'], labels: ['ac', 'at'] },
        {
          projectNames: ['acme', 'acmetools', 'acmelabs'],
          labels: ['ac', 'at', 'al'],
        },
        {
          projectNames: ['acme', 'acmetools', 'atlas'],
          labels: ['ac', 'at', 'al'],
        },
        { projectNames: ['acmetools', 'acme'], labels: ['ac', 'am'] },
      ];
      for (const testCase of cases) {
        const labelByProjectName = assignDashboardDisplayLabels(
          testCase.projectNames,
        );
        expect(
          testCase.projectNames.map((n) => labelByProjectName.get(n)),
        ).toEqual(testCase.labels);
      }
    });

    it('throws when a project name is listed more than once', () => {
      expect(() => assignDashboardDisplayLabels(['acme', 'acme'])).toThrow(
        'Dashboard project name acme is listed more than once',
      );
    });

    it('throws when no unused display label remains for a project name', () => {
      expect(() => assignDashboardDisplayLabels(['ab', 'ac', 'abc'])).toThrow(
        'Dashboard project name abc cannot be given a distinct 2-character display label',
      );
    });

    it('throws for a project name shorter than the display label', () => {
      expect(() => assignDashboardDisplayLabels(['a', 'acme'])).toThrow(
        'Dashboard project name is shorter than the 2-character display label: a',
      );
    });
  });
});
