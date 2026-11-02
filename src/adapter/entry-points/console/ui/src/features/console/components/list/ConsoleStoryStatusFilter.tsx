export type ConsoleStoryStatusFilterProps = {
  statusNames: string[];
  selectedStatuses: string[];
  onToggleStatus: (status: string) => void;
  onClearStatuses: () => void;
};

export const ConsoleStoryStatusFilter = ({
  statusNames,
  selectedStatuses,
  onToggleStatus,
  onClearStatuses,
}: ConsoleStoryStatusFilterProps) => (
  <fieldset
    className="console-story-status-filter"
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
    <legend>Status</legend>
    {statusNames.map((name) => (
      <label
        key={name}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <input
          type="checkbox"
          checked={selectedStatuses.includes(name)}
          onChange={() => onToggleStatus(name)}
        />
        {name}
      </label>
    ))}
    <button
      type="button"
      onClick={onClearStatuses}
      disabled={selectedStatuses.length === 0}
    >
      Clear
    </button>
  </fieldset>
);
