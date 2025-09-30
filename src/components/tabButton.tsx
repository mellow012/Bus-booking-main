import { FC } from 'react';
import { LucideIcon } from 'lucide-react';

interface TabButtonProps {
  id: string;
  label: string;
  icon?: LucideIcon; // Change to LucideIcon to accept icon components
  isActive: boolean;
  onClick: () => void;
}

const TabButton: FC<TabButtonProps> = ({ id, label, icon: Icon, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      {Icon && <Icon className="w-4 h-4" />} {/* Render the icon component if provided */}
      <span>{label}</span>
    </button>
  );
};

export default TabButton;