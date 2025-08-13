import { useState } from 'react';

interface ToggleProps {
  isOn: boolean;
  onChange: (newState: boolean) => void;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ isOn, onChange, className = '' }) => {
  const [internalIsOn, setInternalIsOn] = useState(isOn);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    const newState = !internalIsOn;

    setInternalIsOn(newState);
    onChange(newState);
  };

  return (
    <button
      type="button"
      className={`relative inline-flex h-[.875rem] w-6 mt-1 items-center rounded-full transition-colors bg-neutral-3
        ${className}`}
      onClick={handleClick}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full transition-transform 
          ${internalIsOn ? 'bg-blue translate-x-[0.625rem]' : 'bg-blue-dark translate-x-[.125rem]'}`}
      />
    </button>
  );
};
