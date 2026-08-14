export type ConsoleFetchFailure = {
  section: string;
  message: string;
};

export type ConsoleFetchFailureAlertProps = {
  failures: ConsoleFetchFailure[];
};

export const ConsoleFetchFailureAlert = ({
  failures,
}: ConsoleFetchFailureAlertProps) => {
  if (failures.length === 0) {
    return null;
  }

  return (
    <div role="alert" className="console-detail-fetch-error">
      <ul className="console-detail-fetch-error-list">
        {failures.map((failure) => (
          <li key={failure.section}>
            Failed to load {failure.section}: {failure.message}
          </li>
        ))}
      </ul>
    </div>
  );
};
