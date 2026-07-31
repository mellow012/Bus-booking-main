import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

const containerSizes = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
};

const logoSizes = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
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
        <div className={cn('relative flex items-center justify-center', containerSizes[size])}>
          {/* Animated Spinner Ring */}
          <div
            className={cn(
              'absolute inset-0 rounded-full border-2 border-brand-100 border-t-brand-700 animate-spin',
              className
            )}
          />
          {/* Subtle pulse background glow */}
          <div className="absolute inset-1 rounded-full bg-brand-50/60 animate-pulse" />
          {/* Centered TibhukeBus Logo */}
          <div className={cn('relative z-10 flex items-center justify-center', logoSizes[size])}>
            <Image
              src="/tibhukebus_logo_transparent.png"
              alt="TibhukeBus Logo"
              width={56}
              height={56}
              className="object-contain w-full h-full drop-shadow-sm"
              priority
            />
          </div>
        </div>
        {label ? <p className="mt-3 text-sm font-semibold text-gray-600">{label}</p> : null}
      </div>
    </div>
  );
}

export default LoadingSpinner;

