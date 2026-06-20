import { fileStatusBadge } from './fileStatus';

describe('fileStatusBadge', () => {
  it('maps added to a green A badge', () => {
    expect(fileStatusBadge('added')).toEqual({ label: 'A', color: '#3fb950' });
  });

  it('maps modified to a yellow M badge', () => {
    expect(fileStatusBadge('modified')).toEqual({
      label: 'M',
      color: '#d29922',
    });
  });

  it('maps removed to a red D badge', () => {
    expect(fileStatusBadge('removed')).toEqual({
      label: 'D',
      color: '#f85149',
    });
  });

  it('maps renamed to a purple R badge', () => {
    expect(fileStatusBadge('renamed')).toEqual({
      label: 'R',
      color: '#a371f7',
    });
  });

  it('maps an unknown status to a gray question badge', () => {
    expect(fileStatusBadge('whatever')).toEqual({
      label: '?',
      color: '#8b949e',
    });
  });
});
