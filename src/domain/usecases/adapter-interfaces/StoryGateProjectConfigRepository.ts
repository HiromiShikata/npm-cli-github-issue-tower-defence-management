export type StoryGateProjectConfig = {
  filePath: string;
  org: string;
  agents: string[];
  projectUrl?: string | null;
  repositories?: string[] | null;
};

export interface StoryGateProjectConfigRepository {
  listProjectConfigs(): Promise<StoryGateProjectConfig[]>;
}
