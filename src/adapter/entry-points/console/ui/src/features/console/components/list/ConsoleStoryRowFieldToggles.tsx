import {
  CONSOLE_STORY_ROW_FIELDS,
  type ConsoleStoryRowField,
} from '../../logic/consoleStoryRowFields';

const ROW_FIELD_LABELS: Record<ConsoleStoryRowField, string> = {
  dependedIssueUrl: 'Depended Issue URL',
  nextActionDate: 'Next Action Date',
  nextActionHour: 'Next Action Hour',
  agent: 'Agent',
  story: 'Story',
  status: 'Status',
};

export type ConsoleStoryRowFieldTogglesProps = {
  hiddenFields: ConsoleStoryRowField[];
  onToggle: (field: ConsoleStoryRowField) => void;
};

export const ConsoleStoryRowFieldToggles = ({
  hiddenFields,
  onToggle,
}: ConsoleStoryRowFieldTogglesProps) => (
  <fieldset
    className="console-story-row-field-toggles"
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
      border: 'none',
      margin: 0,
      padding: 0,
    }}
  >
    <legend>Display items</legend>
    {CONSOLE_STORY_ROW_FIELDS.map((field) => (
      <label
        key={field}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <input
          type="checkbox"
          checked={!hiddenFields.includes(field)}
          onChange={() => onToggle(field)}
        />
        {ROW_FIELD_LABELS[field]}
      </label>
    ))}
  </fieldset>
);
