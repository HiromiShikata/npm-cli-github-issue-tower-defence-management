import { type ReactNode, useState } from 'react';

export type ConsolePanelProps = {
  title: string;
  defaultCollapsed?: boolean;
  headerAction?: ReactNode;
  children: ReactNode;
};

export const ConsolePanel = ({
  title,
  defaultCollapsed = false,
  headerAction,
  children,
}: ConsolePanelProps) => {
  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);
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
          <span className="console-panel-title">{title}</span>
        </button>
        {headerAction !== undefined && (
          <div className="console-panel-action">{headerAction}</div>
        )}
      </header>
      {!collapsed && <div className="console-panel-body">{children}</div>}
    </section>
  );
};
