# Component Library - Implementation Guide

## 🎯 Core Components Created

### 1. Skeleton Component (`src/components/ui/skeleton.tsx`)

**Purpose**: Provide loading state feedback before content renders

**Variants**:
- `default` - Generic placeholder (h-12)
- `text` - Inline text loading (h-4)
- `avatar` - Circular placeholder (h-10, w-10)
- `card` - Full card loading (h-64)
- `table-row` - Table row placeholder (h-12)
- `button` - Button placeholder (h-10, w-24)

**Usage**:
```tsx
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonTabs } from '@/components/ui/skeleton';

// Single skeleton
<Skeleton variant="text" count={3} />

// Reusable variants
<SkeletonCard />
<SkeletonTable rows={5} />
<SkeletonTabs />
<SkeletonGrid columns={3} rows={3} />
```

**Rules**:
- Use skeleton for content loading (not actions)
- Always replace full-page `Loader2` spinners with skeletons
- Apply `count` prop to render multiple items
- Show structure of actual content (mirrors layout)

---

### 2. EmptyState Component (`src/components/ui/empty-state.tsx`)

**Purpose**: Display contextual empty state with action

**Variants**:
- `EmptyState` - Custom empty state
- `EmptyStateNoData` - No data message
- `EmptyStateSearchResults` - Search failure
- `EmptyStateError` - Error state with retry
- `EmptyStateAccess` - Permission denied
- `EmptyStateOffline` - Offline state

**Usage**:
```tsx
import { EmptyState, EmptyStateNoData, EmptyStateError } from '@/components/ui/empty-state';

// Custom
<EmptyState
  icon={<UserIcon className="w-16 h-16" />}
  title="No bookings yet"
  description="Create your first booking to get started"
  action={{ label: 'New Booking', onClick: () => {...} }}
/>

// Variants
<EmptyStateNoData />
<EmptyStateSearchResults onClear={handleClear} />
<EmptyStateError onRetry={refetch} />
<EmptyStateAccess />
<EmptyStateOffline />
```

**Rules**:
- Always show empty state when data is empty
- Include action button to create/retry
- Use contextual icon (emoji or SVG)
- Never show blank screens

---

### 3. ErrorBoundary Component (`src/components/ErrorBoundary.tsx`)

**Purpose**: Catch unhandled component errors and display gracefully

**Usage**:
```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

<ErrorBoundary onError={logError}>
  <YourDashboard />
</ErrorBoundary>
```

**Features**:
- Catches errors from child components
- Shows error message and recovery options
- "Try again" button to reset boundary
- "Refresh page" button for hard refresh
- Optional custom fallback UI

---

### 4. useErrorHandler Hook (`src/hooks/useErrorHandler.ts`)

**Purpose**: Centralized error state and handling

**Usage**:
```tsx
import { useErrorHandler, formatErrorMessage } from '@/hooks/useErrorHandler';

const { error, isError, handleError, clearError, setError } = useErrorHandler();

try {
  const data = await fetchData();
} catch (err) {
  handleError(err);
}

if (error) {
  return (
    <AlertMessage
      type="error"
      message={error.message}
      actions={[
        { label: 'Retry', onClick: () => refetch() },
        { label: 'Dismiss', onClick: clearError }
      ]}
    />
  );
}
```

**Error Object**:
```typescript
interface ErrorState {
  message: string;
  code?: string;
  details?: string;
  retryable?: boolean;
}
```

**Common Codes**:
- `NETWORK_ERROR` - Network connection failed
- `TIMEOUT` - Request timed out
- `UNAUTHORIZED` - Permission denied
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Input validation failed
- `SERVER_ERROR` - Server-side error
- `UNKNOWN_ERROR` - Unknown error

---

### 5. useFocusTrap Hook (`src/hooks/useFocusTrap.ts`)

**Purpose**: Trap focus inside modals for accessibility

**Usage**:
```tsx
import { useFocusTrap, useEscapeKey } from '@/hooks/useFocusTrap';

function Modal({ onClose }) {
  const focusRef = useFocusTrap();
  useEscapeKey(onClose);

  return (
    <div ref={focusRef} role="dialog" aria-modal="true">
      <input autoFocus placeholder="First field" />
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

**Features**:
- Traps Tab/Shift+Tab within modal
- Auto-focuses first focusable element
- `useEscapeKey` for Escape key support
- Proper focus management on mount/unmount

---

## 🔄 Migration Pattern

When refactoring a dashboard component:

### Before:
```tsx
const [loading, setLoading] = useState(true);
const [data, setData] = useState([]);
const [error, setError] = useState('');

if (loading) return <Loader2 className="animate-spin" />;
if (error) return <p>{error}</p>;
if (data.length === 0) return <p>No data</p>;

return <DataDisplay data={data} />;
```

### After:
```tsx
const [loading, setLoading] = useState(true);
const [data, setData] = useState<Data[]>([]);
const { error, handleError, clearError } = useErrorHandler();

if (loading) return <SkeletonTable rows={5} />;
if (error) return <EmptyStateError onRetry={refetch} />;
if (data.length === 0) return <EmptyStateNoData />;

return <DataDisplay data={data} />;
```

---

## ✅ Implementation Checklist

For each dashboard component:

- [ ] Replace full-page `Loader2` with `Skeleton*` component
- [ ] Add `EmptyState*` for no-data scenarios
- [ ] Use `useErrorHandler` for error state management
- [ ] Add `ErrorBoundary` around dashboard
- [ ] Wrap modals with `useFocusTrap` and `useEscapeKey`
- [ ] Add ARIA labels to interactive elements
- [ ] Test keyboard navigation (Tab, Escape)
- [ ] Verify empty, loading, error states
- [ ] Test on mobile (320px), tablet (768px), desktop (1920px)

---

## 🎨 Styling Guidelines

### Skeleton Styling
- Uses `bg-slate-200` (light mode), `bg-slate-800` (dark mode)
- `animate-pulse` for loading effect
- Matches content structure for smooth transition

### EmptyState Styling
- `bg-slate-50` background with `border-slate-200`
- Icon size 64px (w-16 h-16) by default
- Action button primary, secondary optional
- Responsive: full-width on mobile, centered on desktop

### ErrorBoundary Styling
- `bg-red-50` with `border-red-200`
- Error icon (⚠️) at top
- Red text for error message
- Buttons for recovery actions

---

## 📚 Related Files

- `.instructions.md` - Design system and standards
- `SKILL.md` - Component development skills
- `tailwind.config.ts` - Design tokens
- `src/lib/utils.ts` - cn() utility for class merging

---

**Version**: 1.0.0  
**Created**: 2026-05-25  
**Last Updated**: 2026-05-25
