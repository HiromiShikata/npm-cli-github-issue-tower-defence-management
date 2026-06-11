import React from 'react';
import { useState } from 'react';

type AccessKeyPromptProps = {
  onSubmit: (key: string) => void;
};

export const AccessKeyPrompt = ({
  onSubmit,
}: AccessKeyPromptProps): React.JSX.Element => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '1rem',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          width: '100%',
          maxWidth: '20rem',
        }}
      >
        <label htmlFor="access-key-input" style={{ fontWeight: 600 }}>
          Enter your access key
        </label>
        <input
          id="access-key-input"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Access key"
          style={{
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '1rem',
          }}
        />
        <button
          type="submit"
          disabled={!value.trim()}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Access
        </button>
      </form>
    </div>
  );
};
