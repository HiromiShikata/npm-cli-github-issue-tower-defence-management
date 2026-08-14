export type ConsoleFetchFailure = {
  section: string;
  message: string;
};

type ConsoleFetchFailureGroup = {
  message: string;
  sections: string[];
};

export type ConsoleFetchFailureAlertProps = {
  failures: ConsoleFetchFailure[];
};

export const groupConsoleFetchFailuresByMessage = (
  failures: ConsoleFetchFailure[],
): ConsoleFetchFailureGroup[] => {
  const sectionsByMessage = new Map<string, string[]>();
  for (const failure of failures) {
    const sections = sectionsByMessage.get(failure.message);
    if (sections === undefined) {
      sectionsByMessage.set(failure.message, [failure.section]);
      continue;
    }
    sections.push(failure.section);
  }
  return Array.from(sectionsByMessage, ([message, sections]) => ({
    message,
    sections,
  }));
};

export const formatConsoleFetchFailureSections = (
  sections: string[],
): string => {
  if (sections.length <= 1) {
    return sections.join('');
  }
  return `${sections.slice(0, -1).join(', ')} and ${sections[sections.length - 1]}`;
};

export const ConsoleFetchFailureAlert = ({
  failures,
}: ConsoleFetchFailureAlertProps) => {
  if (failures.length === 0) {
    return null;
  }

  return (
    <div role="alert" className="console-detail-fetch-error">
      {groupConsoleFetchFailuresByMessage(failures).map((group) => (
        <p key={group.message} className="console-detail-fetch-error-line">
          Failed to load {formatConsoleFetchFailureSections(group.sections)}:{' '}
          {group.message}
        </p>
      ))}
    </div>
  );
};
