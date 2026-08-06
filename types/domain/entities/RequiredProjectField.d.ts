import { FieldOption } from './Project';
export type RequiredProjectFieldDataType = 'DATE' | 'TEXT' | 'SINGLE_SELECT';
export type RequiredProjectFieldDefinition = {
    name: string;
    dataType: RequiredProjectFieldDataType;
    options: Omit<FieldOption, 'id'>[];
};
export declare const STORY_FIELD_NAME = "Story";
export declare const NEXT_ACTION_DATE_FIELD_NAME = "Next Action Date";
export declare const NEXT_ACTION_HOUR_FIELD_NAME = "Next Action Hour";
export declare const DEPENDED_ISSUE_URL_FIELD_NAME = "Depended Issue URL separated by comma";
export declare const REQUIRED_PROJECT_FIELDS: RequiredProjectFieldDefinition[];
//# sourceMappingURL=RequiredProjectField.d.ts.map