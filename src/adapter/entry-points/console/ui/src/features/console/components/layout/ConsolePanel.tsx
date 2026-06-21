import { type ReactNode, useState } from 'react';

export type ConsolePanelProps = {
  title: string;
  count?: number | null;
  defaultCollapsed?: boolean;
  headerAction?: ReactNode;
  children: ReactNode;
};

export const ConsolePanel = ({
  title,
  count = null,
  defaultCollapsed = false,
  headerAction,
  children,
}: ConsolePanelProps) => {
  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);
  const heading = count === null ? title : `${title} (${count})`;
  return (
    <section className="console-panel">
      <header className="console-panel-header">
        <button
          type="button"
          className="console-panel-toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          <span className="console-panel-caret">{collapsed ? '▸' : '▾'}</span>
          <span className="console-panel-title">{heading}</span>
        </button>
        {headerAction !== undefined && (
          <div className="console-panel-action">{headerAction}</div>
        )}
      </header>
      {!collapsed && <div className="console-panel-body">{children}</div>}
    </section>
  );
};
