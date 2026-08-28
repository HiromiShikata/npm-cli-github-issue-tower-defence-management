import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CONSOLE_TABS, type ConsoleTabName } from '../../logic/types';

export type ConsoleTabBarProps = {
  activeTab: ConsoleTabName;
  counts: Record<ConsoleTabName, number>;
  pjcode: string | null;
  pjcodes: string[];
  generatedAt: string | null;
  fromCache: boolean;
  tabHref: (tab: ConsoleTabName) => string;
  onSelectTab: (tab: ConsoleTabName) => void;
  onSelectProject: (pjcode: string) => void;
  settingsButton?: ReactNode;
};

export const ConsoleTabList = ({
  activeTab,
  counts,
  pjcode,
  pjcodes,
  generatedAt,
  fromCache,
  tabHref,
  onSelectTab,
  onSelectProject,
  settingsButton,
}: ConsoleTabBarProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleButtonClick = () => {
    if (!isDropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setIsDropdownOpen((prev) => !prev);
  };

  return (
    <nav aria-label="Console tabs" className="console-tabbar">
      {CONSOLE_TABS.filter((tab) => {
        const count = counts[tab.name] ?? 0;
        return count > 0 || tab.name === activeTab;
      }).map((tab) => {
        const count = counts[tab.name] ?? 0;
        const isActive = tab.name === activeTab;
        return (
          <a
            key={tab.name}
            href={tabHref(tab.name)}
            className="console-tab"
            data-active={isActive ? 'true' : undefined}
            aria-current={isActive ? 'page' : undefined}
            onClick={(event) => {
              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              onSelectTab(tab.name);
            }}
          >
            <span className="console-tab-label">{tab.label}</span>
            <span
              className="console-tab-badge"
              data-zero={count === 0 ? 'true' : undefined}
            >
              {count}
            </span>
          </a>
        );
      })}
      {pjcode !== null && (
        <div className="console-tab-pjname">
          <button
            ref={buttonRef}
            type="button"
            className="console-tab-pjname-button"
            aria-expanded={isDropdownOpen}
            aria-haspopup="menu"
            onClick={handleButtonClick}
          >
            {pjcode}
            <span className="console-tab-pjname-arrow" aria-hidden="true">
              ▾
            </span>
          </button>
          {isDropdownOpen &&
            dropdownPos !== null &&
            createPortal(
              <div
                ref={dropdownRef}
                role="menu"
                className="console-tab-pjname-dropdown"
                aria-label="Select project"
                style={{
                  position: 'fixed',
                  top: dropdownPos.top,
                  right: dropdownPos.right,
                }}
              >
                {pjcodes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    role="menuitem"
                    className="console-tab-pjname-option"
                    data-active={code === pjcode ? 'true' : undefined}
                    onClick={() => {
                      onSelectProject(code);
                      setIsDropdownOpen(false);
                    }}
                  >
                    {code}
                  </button>
                ))}
              </div>,
              document.body,
            )}
        </div>
      )}
      {generatedAt !== null && (
        <span
          className="console-tab-geninfo"
          data-from-cache={fromCache ? 'true' : undefined}
        >
          {fromCache ? '(cached) ' : ''}snapshot: {generatedAt}
        </span>
      )}
      {settingsButton !== undefined && (
        <span className="console-tab-settings">{settingsButton}</span>
      )}
    </nav>
  );
};
