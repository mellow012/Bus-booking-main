import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'text' | 'avatar' | 'card' | 'table-row' | 'button';
  count?: number;
}

export function Skeleton({
  className,
  variant = 'default',
  count = 1,
  ...props
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-slate-200 dark:bg-slate-800';

  const variantClasses = {
    default: 'h-12 rounded-md',
    text: 'h-4 rounded-md',
    avatar: 'h-10 w-10 rounded-full',
    card: 'h-64 rounded-lg',
    'table-row': 'h-12 rounded-md',
    button: 'h-10 w-24 rounded-md',
  };

  const skeletonClass = cn(
    baseClasses,
    variantClasses[variant],
    className
  );

  if (count > 1) {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={skeletonClass} {...props} />
        ))}
      </div>
    );
  }

  return <div className={skeletonClass} {...props} />;
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton variant="text" className="w-3/4" />
      <Skeleton variant="text" className="w-full h-6" />
      <Skeleton variant="text" className="w-5/6 h-4" />
      <div className="flex gap-2 pt-2">
        <Skeleton variant="button" />
        <Skeleton variant="button" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 p-3">
        <Skeleton variant="text" className="w-10 h-4" />
        <Skeleton variant="text" className="flex-1 h-4" />
        <Skeleton variant="text" className="flex-1 h-4" />
        <Skeleton variant="text" className="w-20 h-4" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3 border-t border-slate-200">
          <Skeleton variant="text" className="w-10 h-4" />
          <Skeleton variant="text" className="flex-1 h-4" />
          <Skeleton variant="text" className="flex-1 h-4" />
          <Skeleton variant="text" className="w-20 h-4" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTabs() {
  return (
    <div className="space-y-4">
      {/* Tab headers */}
      <div className="flex gap-2 border-b border-slate-200">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="text" className="w-24 h-4" />
        ))}
      </div>
      {/* Tab content */}
      <div className="space-y-3">
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="text" className="w-full h-32" />
        <Skeleton variant="text" className="w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ columns = 3, rows = 3 }) {
  return (
    <div className={`grid grid-cols-${columns} gap-4`}>
      {Array.from({ length: columns * rows }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
