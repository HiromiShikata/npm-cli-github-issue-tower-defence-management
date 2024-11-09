export type Issue = {
  nameWithOwner: string;
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  url: string;
  timeline: Array<{
    issueUrl: string;
    author: string;
    start: string;
    end: string;
  }>;
};
