import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
};

export function LoadingSpinner({
  className,
  label,
  size = 'md',
  fullScreen = false,
}: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center', fullScreen && 'min-h-screen')}>
      <div className="flex flex-col items-center justify-center">
        <Loader2 className={cn('animate-spin text-indigo-600', sizeClasses[size], className)} />
        {label ? <p className="mt-3 text-sm font-medium text-gray-500">{label}</p> : null}
      </div>
    </div>
  );
}

export default LoadingSpinner;
