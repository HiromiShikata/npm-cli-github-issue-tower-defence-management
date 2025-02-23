export type StoryOption = FieldOption;
export type FieldOption = {
    id: string;
    name: string;
    color: 'GRAY' | 'BLUE' | 'PINK' | 'YELLOW' | 'GREEN' | 'RED' | 'PURPLE';
    description: string;
};
export type Project = {
    id: string;
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
    } | null;
    story: {
        name: string;
        fieldId: string;
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
};
//# sourceMappingURL=Project.d.ts.map