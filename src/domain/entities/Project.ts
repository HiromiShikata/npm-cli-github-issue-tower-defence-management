import { ProjectField } from './ProjectField';

export type Project = {
  id: string;
  name: string;
  fields: ProjectField[];
};
