export declare const FIELD_OPTION_COLORS: readonly ["GRAY", "BLUE", "GREEN", "YELLOW", "ORANGE", "RED", "PINK", "PURPLE"];
export type StoryOption = FieldOption;
export type FieldOption = {
    id: string;
    name: string;
    color: (typeof FIELD_OPTION_COLORS)[number];
    description: string;
};
export type StoryListEntry = Omit<FieldOption, 'id'> & {
    id: FieldOption['id'] | null;
};
export declare const buildStoryListWithNew: (existingStories: StoryListEntry[], newName: string) => StoryListEntry[];
export type Project = {
    id: string;
    url: string;
    databaseId: number;
    name: string;
    status: {
        name: string;
        fieldId: string;
        statuses: FieldOption[];
    };
    nextActionDate: {
        name: string;
        fieldId: string;
    } | null;
    nextActionHour: {
        name: string;
        fieldId: string;
        options: FieldOption[];
    } | null;
    story: {
        name: string;
        fieldId: string;
        databaseId: number;
        stories: FieldOption[];
        workflowManagementStory: {
            id: string;
            name: string;
        };
    } | null;
    remainingEstimationMinutes: {
        name: string;
        fieldId: string;
    } | null;
    dependedIssueUrlSeparatedByComma: {
        name: string;
        fieldId: string;
    } | null;
    completionDate50PercentConfidence: {
        name: string;
        fieldId: string;
    } | null;
    agent: {
        name: string;
        fieldId: string;
        options: FieldOption[];
    } | null;
};
//# sourceMappingURL=Project.d.ts.map