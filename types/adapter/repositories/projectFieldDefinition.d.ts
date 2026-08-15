import { FieldOption, Project } from '../../domain/entities/Project';
export type ProjectFieldDefinition = {
    fieldId: string;
    databaseId: number;
    name: string;
    options: FieldOption[];
};
export type ProjectDefinition = {
    id: string;
    url: string;
    databaseId: number;
    name: string;
    fields: ProjectFieldDefinition[];
};
export declare const convertToFieldOptionColor: (color: string) => FieldOption["color"];
export declare const projectFromDefinition: (definition: ProjectDefinition) => Project;
//# sourceMappingURL=projectFieldDefinition.d.ts.map