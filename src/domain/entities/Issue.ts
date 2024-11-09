import { WorkingTime } from './WorkingTime';
import { Member } from './Member';
export type Label = string;
export type Issue = {
  nameWithOwner: string;
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  url: string;
  assignees: Member['name'][];
  workingTimeline: WorkingTime[];
  labels: Label[];
};
