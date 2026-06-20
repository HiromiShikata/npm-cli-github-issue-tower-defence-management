export type ConsoleProjectHeaderProps = {
  pjcode: string | null;
};

export const ConsoleProjectHeader = ({ pjcode }: ConsoleProjectHeaderProps) => (
  <header className="flex items-baseline gap-2 border-b border-border p-3">
    <h1 className="text-base font-semibold">TDPM Console</h1>
    {pjcode === null ? (
      <span className="text-sm text-muted-foreground">no project selected</span>
    ) : (
      <span className="text-sm text-muted-foreground">project: {pjcode}</span>
    )}
  </header>
);
