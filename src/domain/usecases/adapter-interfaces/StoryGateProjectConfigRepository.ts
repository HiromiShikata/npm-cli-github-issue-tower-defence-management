export type StoryGateProjectConfig = {
  filePath: string;
  org: string;
  agents: string[];
};

export interface StoryGateProjectConfigRepository {
  listProjectConfigs(): Promise<StoryGateProjectConfig[]>;
}
