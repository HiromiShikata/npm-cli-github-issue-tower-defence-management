import { ProjectField } from './ProjectField';

export type ProjectFieldSingleSelectOption = {
  projectFieldId: ProjectField['id'];
  id: string;
  value: string;
  description: string;
};
