# 🔍 OPERATOR DASHBOARD AUDIT & REFACTORING GUIDE

**File**: `src/app/company/operator/dashboard/page.tsx` (1064 lines)

---

## 📊 Current Issues Found

### 1. ❌ LOADING STATE (Line 273-274)
**Current**:
```tsx
if (loading || authLoading) {
  return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>;
}
```

**Problems**:
- ❌ Blank screen with only spinner (no content skeleton)
- ❌ User doesn't know what's loading
- ❌ Takes 2-3 seconds with no feedback
- ❌ No progressive rendering

**Fix**:
```tsx
import { SkeletonTabs } from '@/components/ui/skeleton';

if (loading || authLoading) {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <div className="h-20 border-b border-gray-100" /> {/* Header skeleton */}
      <main className="flex-1 p-8">
        <SkeletonTabs />
      </main>
    </div>
  );
}
```

---

### 2. ❌ ERROR HANDLING (Line 43, 160, 182)
**Current**:
```tsx
const [globalError, setGlobalError] = useState('');
// ...
setGlobalError("Operational sync interrupted.");
// ...
setGlobalError(err.message || `Failed to add ${table}`);
```

**Problems**:
- ❌ Generic error message
- ❌ No retry button
- ❌ No structured error object
- ❌ Stored in global state (not scalable)

**Fix**:
```tsx
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { EmptyStateError } from '@/components/ui/empty-state';

const { error, handleError, clearError } = useErrorHandler();

// In catch blocks:
catch (error: any) {
  handleError(error, { 
    action: 'fetch_schedules',
    retryable: true 
  });
}

// In JSX:
{error && (
  <EmptyStateError 
    onRetry={() => {
      clearError();
      fetchInitialData();
    }} 
  />
)}
```

---

### 3. ❌ EMPTY STATES (No current handling)
**Current**:
```tsx
{stats.upcomingTrips.length > 0 || ... ? (
  // Show content
) : null}
```

**Problems**:
- ❌ Nothing displayed when no trips
- ❌ User thinks dashboard is broken
- ❌ No guidance on next steps
- ❌ Confusing UX

**Fix**:
```tsx
import { EmptyStateNoData } from '@/components/ui/empty-state';

{stats.upcomingTrips.length > 0 ? (
  // Show content
) : (
  <EmptyStateNoData 
    title="No trips scheduled"
    description="Create your first trip to get started"
    action={{
      label: 'Create New Trip',
      onClick: () => setActiveTab('schedules')
    }}
  />
)}
```

---

### 4. ❌ ACCESSIBILITY - MISSING ARIA LABELS

**Line 310 - Tab buttons**:
```tsx
// CURRENT - BAD
<button key={tab.id} onClick={() => { ... }} className={...}>
  <Icon className={...} /> {tab.label}
</button>

// FIXED - GOOD
<button 
  key={tab.id}
  onClick={() => { ... }}
  role="tab"
  aria-selected={activeTab === tab.id}
  aria-label={`View ${tab.label} tab`}
  className={cn(
    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold',
    'focus:outline-2 focus:outline-indigo-600',
    activeTab === tab.id 
      ? 'bg-indigo-50 text-indigo-700' 
      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
  )}
>
  <Icon className={...} /> {tab.label}
</button>
```

**Line 327-333 - Menu button**:
```tsx
// CURRENT - BAD
<button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden ...">
  <Menu className="w-6 h-6 text-gray-600" />
</button>

// FIXED - GOOD
<button 
  onClick={() => setIsMobileMenuOpen(true)}
  aria-label="Open navigation menu"
  aria-expanded={isMobileMenuOpen}
  className="lg:hidden p-2.5 hover:bg-gray-50 rounded-xl transition-colors border border-gray-100"
>
  <Menu className="w-6 h-6 text-gray-600" />
</button>
```

**Line 301 - Close button**:
```tsx
// CURRENT - BAD
<button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 ...">
  <X className="w-5 h-5" />
</button>

// FIXED - GOOD
<button 
  onClick={() => setIsMobileMenuOpen(false)}
  aria-label="Close navigation menu"
  className="lg:hidden p-2 text-gray-400 hover:bg-gray-50 rounded-lg focus:outline-2 focus:outline-indigo-600"
>
  <X className="w-5 h-5" />
</button>
```

---

### 5. ❌ MISSING FOCUS INDICATORS

**Problem**: No visible focus outline for keyboard navigation

**Current**: Some buttons have no focus state
**Fix**: Add to all interactive elements:
```tsx
className={cn(
  'transition-all',
  'focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600'
)}
```

---

### 6. ❌ MISSING ERROR BOUNDARY

**Current**: No error boundary wrapper
```tsx
export default function OperatorDashboard() {
  // If any child component crashes, whole page breaks
  return (
    <div>
      <SchedulesTab /> {/* If this errors... */}
      <RoutesTab /> {/* ...whole app crashes */}
    </div>
  );
}
```

**Fix**:
```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function OperatorDashboard() {
  return (
    <ErrorBoundary>
      <div className="...">
        <SchedulesTab />
        <RoutesTab />
        {/* other tabs */}
      </div>
    </ErrorBoundary>
  );
}
```

---

### 7. ⚠️ MISSING SEMANTIC HTML

**Line 352-364** (Alert messages):
```tsx
// CURRENT - BAD (div instead of semantic tag)
<div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl ...">
  <span className="font-bold text-sm">{globalError}</span>
  <button onClick={() => setGlobalError('')}><X className="w-4 h-4" /></button>
</div>

// FIXED - GOOD (use semantic alert role)
<div 
  role="alert"
  aria-live="polite"
  className="bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-100 flex items-center justify-between"
>
  <span className="font-bold text-sm">{error?.message || globalError}</span>
  <button 
    onClick={() => setGlobalError('')}
    aria-label="Dismiss error message"
    className="focus:outline-2 focus:outline-indigo-600"
  >
    <X className="w-4 h-4" />
  </button>
</div>
```

---

### 8. ⚠️ INCONSISTENT COLORS (Not following design tokens)

**Current**: Using hardcoded colors like `bg-gray-50`, `bg-red-50`, etc.

**Fix**: Map to design tokens:
```tsx
// Use design token variables from tailwind.config.ts
const ALERT_COLORS = {
  error: 'bg-red-50 text-red-700 border-red-100',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  info: 'bg-blue-50 text-blue-700 border-blue-100'
};
```

---

## ✅ WHAT'S GOOD

1. ✅ Real-time subscriptions (lines 201-230) - Good architecture
2. ✅ Responsive layout (sidebar responsive on mobile)
3. ✅ Stats calculation (lines 232-269) - Good business logic
4. ✅ Tab routing (lines 24-32) - Clean tab structure
5. ✅ Visibility-aware polling - Good optimization
6. ✅ Company branding in sidebar - Good personalization

---

## 🎯 TIER 1 REFACTORING CHECKLIST

### Phase 1: Foundation (15 min)
- [ ] Import new components and hooks
- [ ] Replace Loader2 spinner with SkeletonTabs
- [ ] Add ErrorBoundary wrapper
- [ ] Switch from globalError to useErrorHandler

### Phase 2: Error Handling (20 min)
- [ ] Update all catch blocks to use handleError()
- [ ] Add EmptyStateError component
- [ ] Add retry buttons

### Phase 3: Empty States (15 min)
- [ ] Add EmptyStateNoData for overview tab
- [ ] Add empty states for other tabs (schedules, bookings, routes, buses, reports)
- [ ] Add contextual messages

### Phase 4: Accessibility (30 min)
- [ ] Add aria-label to all buttons
- [ ] Add role="tab" to tab buttons
- [ ] Add aria-selected to active tab
- [ ] Add aria-live="polite" to alerts
- [ ] Add focus indicators to all interactive elements
- [ ] Add aria-expanded to menu button

### Phase 5: Testing (25 min)
- [ ] Test keyboard navigation (Tab, Enter, Escape)
- [ ] Test with screen reader (NVDA/JAWS)
- [ ] Test responsive (320px, 768px, 1920px)
- [ ] Check console for errors/warnings
- [ ] Run linter

---

## 📋 FILE SECTIONS TO MODIFY

1. **Imports** (lines 1-22): Add new components
2. **Loading state** (lines 273-274): Replace Loader2
3. **Error state** (lines 352-364): Replace globalError alerts
4. **Tabs** (lines 24-32): Add ARIA labels
5. **Tab buttons** (line 310): Add accessibility attributes
6. **Menu buttons** (lines 327-333, 301): Add accessibility
7. **Render function**: Wrap with ErrorBoundary
8. **Empty state content** (line 366-onwards): Add EmptyStateNoData

---

## 🚀 IMPLEMENTATION ORDER

1. Start with imports
2. Fix loading state (most visible)
3. Fix error handling (most impactful)
4. Add accessibility (most compliant)
5. Add empty states (most polished)
6. Add error boundary (most robust)
7. Test everything

---

## ⏱️ Estimated Time

| Task | Time |
|------|------|
| Imports + Setup | 5 min |
| Loading States | 10 min |
| Error Handling | 15 min |
| Accessibility | 25 min |
| Empty States | 10 min |
| Error Boundary | 5 min |
| Testing | 20 min |
| **TOTAL** | **90 min** |

---

## ✨ Expected Result

After refactoring:
- ✅ No blank loading screens (skeleton loaders)
- ✅ Clear error messages with retry buttons
- ✅ Contextual empty state messages
- ✅ 100% keyboard accessible
- ✅ Screen reader compatible
- ✅ WCAG 2.1 AA compliant
- ✅ Component errors don't crash page
- ✅ No console errors/warnings
- ✅ Linter passing

---

Ready to start? I recommend:
1. First, look at the current code structure
2. Then apply fixes to the Overview tab
3. Then copy patterns to other tabs
4. Finally, test everything

Let's go! 🚀
