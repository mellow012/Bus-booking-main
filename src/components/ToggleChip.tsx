import React, { FC } from 'react';

interface ToggleChipProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const ToggleChip: FC<ToggleChipProps> = ({ label, isActive, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors whitespace-nowrap
        ${isActive ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
      `}
    >
      {label}
    </button>
  );
};

export default ToggleChip;
