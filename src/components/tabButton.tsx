import { FC, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface TabButtonProps {
  id?: string;
  label?: string;
  icon?: LucideIcon;
  isActive: boolean;
  onClick: () => void;
  children?: ReactNode;
}

const TabButton: FC<TabButtonProps> = ({ id, label, icon: Icon, isActive, onClick, children }) => {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children ?? (label && <span>{label}</span>)}
    </button>
  );
};

export default TabButton;
