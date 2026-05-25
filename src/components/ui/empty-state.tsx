import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 py-12 px-6 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-slate-400">
          {typeof icon === 'string' ? (
            <span className="text-5xl">{icon}</span>
          ) : (
            <div className="w-16 h-16 text-slate-400">{icon}</div>
          )}
        </div>
      )}

      <h3 className="mb-2 text-lg font-semibold text-slate-900">{title}</h3>

      {description && (
        <p className="mb-6 max-w-sm text-sm text-slate-600">{description}</p>
      )}

      {action && (
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <Button
            onClick={action.onClick}
            variant={action.variant || 'default'}
          >
            {action.label}
          </Button>
          {secondaryAction && (
            <Button variant="ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Specific empty state variants
export function EmptyStateNoData() {
  return (
    <EmptyState
      icon="📭"
      title="No data found"
      description="There's nothing to show here yet. Try adjusting your filters or creating a new item."
    />
  );
}

export function EmptyStateSearchResults({
  onClear,
}: {
  onClear?: () => void;
}) {
  return (
    <EmptyState
      icon="🔍"
      title="No results found"
      description="We couldn't find anything matching your search. Try different keywords."
      action={
        onClear
          ? { label: 'Clear search', onClick: onClear, variant: 'outline' }
          : undefined
      }
    />
  );
}

export function EmptyStateError({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon="⚠️"
      title="Something went wrong"
      description="We encountered an error while loading this data. Please try again."
      action={
        onRetry
          ? { label: 'Retry', onClick: onRetry, variant: 'default' }
          : undefined
      }
    />
  );
}

export function EmptyStateAccess() {
  return (
    <EmptyState
      icon="🔐"
      title="Access denied"
      description="You don't have permission to view this content. Contact your administrator for help."
    />
  );
}

export function EmptyStateOffline() {
  return (
    <EmptyState
      icon="📡"
      title="You're offline"
      description="Check your internet connection and try again."
    />
  );
}
