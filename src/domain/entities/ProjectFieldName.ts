export const normalizeProjectFieldName = (fieldName: string): string =>
  fieldName.toLowerCase().replace(/[\s-()]/g, '');
