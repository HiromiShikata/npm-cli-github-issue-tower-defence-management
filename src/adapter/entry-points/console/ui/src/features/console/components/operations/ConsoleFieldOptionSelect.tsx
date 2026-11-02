import { useLayoutEffect, useRef } from 'react';
import type { ConsoleFieldOption } from '../../logic/types';

type ConsoleFieldOptionSelectProps = {
  className: string;
  ariaLabel: string;
  placeholder: string;
  currentOption: ConsoleFieldOption | null;
  options: ConsoleFieldOption[];
  onSelect: (option: ConsoleFieldOption) => void;
  disabled?: boolean;
};

export const ConsoleFieldOptionSelect = ({
  className,
  ariaLabel,
  placeholder,
  currentOption,
  options,
  onSelect,
  disabled = false,
}: ConsoleFieldOptionSelectProps) => {
  const stateRef = useRef({
    ready: false,
    currentOptionId: currentOption?.id ?? null,
  });

  useLayoutEffect(() => {
    stateRef.current.ready = true;
    stateRef.current.currentOptionId = currentOption?.id ?? null;
  });

  return (
    <select
      className={className}
      defaultValue={currentOption?.id ?? ''}
      disabled={disabled}
      onChange={(event) => {
        if (!stateRef.current.ready) return;
        if (event.target.value === (stateRef.current.currentOptionId ?? ''))
          return;
        const option = options.find((o) => o.id === event.target.value);
        if (option !== undefined) {
          onSelect(option);
        }
      }}
      aria-label={ariaLabel}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
};
