# 🚀 Quick Start Guide - Dashboard Standardization

> Get started implementing UI/UX standardization in 5 minutes

---

## 📖 Read These First

1. **`.instructions.md`** (5 min)
   - Design system overview
   - Code standards
   - Development workflow

2. **`ACCESSIBILITY.md`** (10 min)
   - Keyboard navigation requirements
   - ARIA attributes checklist
   - Screen reader patterns

3. **`COMPONENTS.md`** (10 min)
   - Component usage examples
   - Migration patterns
   - Implementation checklist

---

## 🎯 Start Refactoring a Dashboard

### Step 1: Set Up Error Handling (15 min)

Replace top-level error state:

```tsx
// Before
const [globalError, setGlobalError] = useState('');
const [successMessage, setSuccessMessage] = useState('');

// After
import { useErrorHandler } from '@/hooks/useErrorHandler';

const { error, handleError, clearError } = useErrorHandler();
```

### Step 2: Add Loading States (20 min)

Replace `Loader2` spinners:

```tsx
// Before
if (loading) return <Loader2 className="animate-spin" />;

// After
import { SkeletonTable, SkeletonTabs } from '@/components/ui/skeleton';

if (loading) return <SkeletonTable rows={5} />;
```

### Step 3: Add Empty States (15 min)

Handle no-data scenarios:

```tsx
// Before
if (data.length === 0) return <p>No data</p>;

// After
import { EmptyStateNoData } from '@/components/ui/empty-state';

if (data.length === 0) return <EmptyStateNoData />;
```

### Step 4: Add Accessibility (20 min)

Add ARIA and keyboard support:

```tsx
// Before
<button onClick={close}>✕</button>

// After
<button 
  onClick={close}
  aria-label="Close modal"
  className="focus:outline-2 focus:outline-indigo-600"
>
  ✕
</button>
```

### Step 5: Test Everything (15 min)

- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Empty/loading/error states display correctly
- [ ] Responsive on mobile (320px), tablet (768px), desktop (1920px)
- [ ] No console errors
- [ ] Lint passes: `npm run lint`

**Total Time**: ~85 minutes per dashboard view

---

## 🛠️ Common Refactoring Patterns

### Pattern 1: Replace Full-Page Loader

```tsx
// ❌ Before
{loading && <Loader2 className="h-10 w-10 animate-spin" />}

// ✅ After
{loading && <SkeletonTable rows={5} />}
```

### Pattern 2: Add Error Retry

```tsx
// ❌ Before
{error && <AlertMessage message={error} />}

// ✅ After
{error && (
  <EmptyStateError onRetry={() => {
    clearError();
    refetch();
  }} />
)}
```

### Pattern 3: Standardize Buttons

```tsx
// ❌ Before
<button className="px-4 py-2 bg-indigo-600 text-white">Click</button>

// ✅ After
<Button variant="default">Click</Button>
```

### Pattern 4: Add Modal Accessibility

```tsx
// ❌ Before
<div className="fixed inset-0 bg-black/50">
  <div className="bg-white p-6">
    <button onClick={onClose}>✕</button>
  </div>
</div>

// ✅ After
function Modal({ onClose }) {
  const focusRef = useFocusTrap();
  useEscapeKey(onClose);
  
  return (
    <div 
      ref={focusRef}
      className="fixed inset-0 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-white p-6">
        <h2 id="modal-title">Modal Title</h2>
        <button 
          onClick={onClose}
          aria-label="Close modal"
          className="focus:outline-2 focus:outline-indigo-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
```

---

## 📋 Implementation Checklist

Use this for each dashboard component:

- [ ] Replace full-page Loader2 with Skeleton
- [ ] Add empty state for no data
- [ ] Use useErrorHandler for errors
- [ ] Add ARIA labels to buttons/links
- [ ] Add aria-label to icon-only buttons
- [ ] Implement focus trap in modals
- [ ] Support Escape key to close modals
- [ ] Test Tab/Shift+Tab navigation
- [ ] Verify color contrast (WCAG AA)
- [ ] Test on mobile (320px)
- [ ] Test on tablet (768px)
- [ ] Test on desktop (1920px)
- [ ] Run `npm run lint`
- [ ] No console errors in browser
- [ ] Screenshot for PR

---

## 🎨 Design Token Quick Reference

### Colors
```
Primary:     indigo-600
Success:     emerald-600
Error:       red-600
Warning:     amber-600
Info:        blue-600
Neutral:     slate-600
Background:  slate-50
Surface:     white
Border:      slate-200
```

### Spacing (4px grid)
```
px-1 py-1 gap-1      = 4px
px-2 py-2 gap-2      = 8px
px-3 py-3 gap-3      = 12px
px-4 py-4 gap-4      = 16px (default)
px-6 py-6 gap-6      = 24px
px-8 py-8 gap-8      = 32px
px-12 py-12 gap-12   = 48px
```

### Animations
```
duration-150   = 150ms (fast)
duration-200   = 200ms (standard)
duration-300   = 300ms (slow)
```

---

## 🐛 Common Issues & Fixes

### Issue: Skeleton not showing
```tsx
// ❌ Wrong
{loading && <SkeletonTable />}
{!loading && <DataTable />}

// ✅ Correct
{loading ? <SkeletonTable /> : <DataTable />}
```

### Issue: Modal focus not trapping
```tsx
// ❌ Forgot to add ref
<div role="dialog">

// ✅ Add ref
const focusRef = useFocusTrap();
<div ref={focusRef} role="dialog">
```

### Issue: Button not keyboard accessible
```tsx
// ❌ Using onClick on div
<div onClick={handleClose}>✕</div>

// ✅ Use button element
<button onClick={handleClose}>✕</button>
```

### Issue: Icon button not labeled
```tsx
// ❌ No label
<button><SearchIcon /></button>

// ✅ Add label
<button aria-label="Search"><SearchIcon /></button>
```

---

## 📞 Need Help?

**Reference Files**:
- `.instructions.md` - Development standards
- `ACCESSIBILITY.md` - A11y patterns
- `COMPONENTS.md` - Component usage
- `SKILL.md` - Development skills

**Code Examples**:
- All components in `src/components/ui/`
- All hooks in `src/hooks/`
- See existing dashboard implementations

**Testing**:
- Chrome DevTools > Accessibility tab
- axe DevTools browser extension
- Keyboard-only navigation test
- Screen reader test (Windows Narrator)

---

## ✅ Commit Template

```
feat(operator-dashboard): add loading skeleton and error retry

- Replace Loader2 with SkeletonTable component
- Add useErrorHandler for error state management
- Implement retry button on API errors
- Add ARIA labels to all buttons
- Test keyboard navigation (Tab, Escape)

Closes #123
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## 🎯 Success Criteria

Component is ready when:
- ✅ Loading state shows skeleton (not spinner)
- ✅ Empty state shows contextual message
- ✅ Error state has retry button
- ✅ Keyboard navigation works (Tab, Enter, Escape)
- ✅ ARIA labels present on all buttons
- ✅ Color contrast WCAG AA compliant
- ✅ Responsive on 320px, 768px, 1920px
- ✅ No console errors
- ✅ Lint passes
- ✅ Tests included

---

**Ready?** Pick a dashboard view and start refactoring! 🚀
