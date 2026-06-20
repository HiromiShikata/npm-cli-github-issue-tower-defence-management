export type ConsoleFileStatusBadge = {
  label: string;
  color: string;
};

export const fileStatusBadge = (status: string): ConsoleFileStatusBadge => {
  switch (status) {
    case 'added':
      return { label: 'A', color: '#3fb950' };
    case 'modified':
      return { label: 'M', color: '#d29922' };
    case 'removed':
      return { label: 'D', color: '#f85149' };
    case 'renamed':
      return { label: 'R', color: '#a371f7' };
    case 'changed':
      return { label: 'M', color: '#d29922' };
    default:
      return { label: '?', color: '#8b949e' };
  }
};
