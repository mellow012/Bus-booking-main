# Accessibility Standardization Guide (WCAG 2.1 AA)

> Production-ready accessibility standards for Bus Booking Platform dashboards

## 🎯 Overview

All dashboards must comply with WCAG 2.1 Level AA standards for:
- Keyboard navigation
- Screen reader support
- Color contrast
- Focus management
- Semantic HTML

## ⌨️ Keyboard Navigation

### Required for All Interactive Elements

**Buttons & Links**:
```tsx
// ✅ Good: Semantic button with proper focus
<button 
  aria-label="Close modal"
  className="focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600"
>
  ✕
</button>

// ❌ Bad: Div instead of button
<div onClick={close} className="cursor-pointer">✕</div>
```

**Tab Order**:
```tsx
// ✅ Natural tab order (source order matches visual order)
<form>
  <input name="email" />
  <input name="password" />
  <button type="submit">Login</button>
</form>

// ❌ Bad: Using tabindex for layout
<input tabindex="1" />
<input tabindex="3" />
<button tabindex="2">Submit</button>
```

**Skip Links** (on mobile):
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
<main id="main-content">
  {/* Content */}
</main>
```

### Keyboard Shortcuts

**Must Support**:
- `Tab` - Navigate between elements
- `Shift+Tab` - Navigate backwards
- `Enter` - Activate button, submit form
- `Space` - Toggle checkbox, click button
- `Escape` - Close modal/dropdown
- `Arrow Up/Down` - Navigate in dropdown, tabs

**Implementation**:
```tsx
function Modal({ onClose }) {
  const focusRef = useFocusTrap();
  useEscapeKey(onClose);

  return (
    <div 
      ref={focusRef} 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <h2 id="modal-title">Modal Title</h2>
      <input autoFocus />
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

---

## 🎤 Screen Reader Support

### ARIA Labels

**For Icons-Only Buttons**:
```tsx
// ✅ Good: Icon button with aria-label
<button aria-label="Search" className="p-2">
  <SearchIcon />
</button>

// ❌ Bad: Icon button with no label
<button className="p-2">
  <SearchIcon />
</button>
```

**For Modals/Dialogs**:
```tsx
<div 
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-desc"
>
  <h2 id="dialog-title">Dialog Title</h2>
  <p id="dialog-desc">Description of what this dialog does</p>
</div>
```

**For Form Fields**:
```tsx
// ✅ Good: Label associated with input
<label htmlFor="email">Email address</label>
<input id="email" type="email" />

// ❌ Bad: Placeholder instead of label
<input placeholder="Email address" />
```

**For Status Indicators**:
```tsx
<span 
  className="inline-flex items-center gap-2"
  aria-label="Trip status: In Progress"
>
  <span className="w-2 h-2 rounded-full bg-indigo-600" />
  In Progress
</span>
```

### ARIA Attributes Reference

| Attribute | Use Case | Example |
|-----------|----------|---------|
| `aria-label` | Accessible name for icon/element | `<button aria-label="Close">✕</button>` |
| `aria-labelledby` | References element id that labels this | `<div aria-labelledby="title-id">` |
| `aria-describedby` | References description | `<input aria-describedby="hint">` |
| `aria-hidden="true"` | Hide from screen readers | Decorative icons, dividers |
| `aria-live="polite"` | Announce updates | Toast notifications, status changes |
| `aria-modal="true"` | Indicates modal dialog | Modals, overlays |
| `aria-pressed` | Toggle button state | Sidebar collapse button |
| `aria-expanded` | Expand/collapse state | Dropdowns, accordions |
| `aria-current="page"` | Current active page | Navigation links |
| `role="alert"` | Urgent announcement | Error messages |
| `role="status"` | Non-urgent update | Loading status, success message |
| `role="dialog"` | Dialog/modal container | Modals |
| `role="tablist"` | Tab container | Tab navigation |
| `role="tab"` | Individual tab | Tab button |
| `role="tabpanel"` | Tab content | Tab content area |

---

## 🎨 Color Contrast

### WCAG AA Minimum Requirements

- **Normal text**: 4.5:1 contrast ratio
- **Large text** (18pt+): 3:1 contrast ratio
- **UI components**: 3:1 contrast ratio

### Standard Color Pairs

| Text | Background | Ratio | Status |
|------|-----------|-------|--------|
| `slate-900` | `white` | 14.8:1 | ✅ AA |
| `slate-700` | `white` | 9.4:1 | ✅ AA |
| `slate-600` | `white` | 7.1:1 | ✅ AA |
| `slate-600` | `slate-50` | 6.8:1 | ✅ AA |
| `indigo-600` | `white` | 5.0:1 | ✅ AA |
| `emerald-600` | `white` | 4.8:1 | ✅ AA |
| `red-600` | `white` | 4.5:1 | ✅ AA |
| `amber-600` | `white` | 4.8:1 | ✅ AA |

### Testing

```bash
# Browser DevTools > Accessibility > Color Contrast
# Or use axe DevTools browser extension
```

### Code Examples

```tsx
// ✅ Good: Sufficient contrast
<p className="text-slate-700">
  This text has 9.4:1 contrast ratio on white background
</p>

// ❌ Bad: Insufficient contrast
<p className="text-slate-400">
  This text has only 2.1:1 contrast ratio on white background
</p>

// ✅ Good: Error message with color + icon
<div className="flex items-center gap-2 text-red-600">
  <AlertIcon />
  Invalid email address
</div>

// ❌ Bad: Relying only on color
<div className="text-red-600">
  Invalid email address (color-blind users won't understand)
</div>
```

---

## 🎯 Focus Management

### Focus Indicators

```tsx
// ✅ Good: Visible focus ring
<button className="focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600">
  Submit
</button>

// ❌ Bad: No visible focus indicator
<button className="focus:outline-none">
  Submit
</button>

// Alternative: Using ring utility
<input 
  className="focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
/>
```

### Focus Trap (Modals)

```tsx
function Modal({ onClose }) {
  const focusRef = useFocusTrap(); // Traps Tab/Shift+Tab within modal
  useEscapeKey(onClose); // Allow Escape to close

  return (
    <div ref={focusRef} role="dialog" aria-modal="true">
      <input autoFocus /> {/* Auto-focus first input */}
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

### Focus Management on Navigation

```tsx
function DashboardNav({ activeTab, onTabChange }) {
  return (
    <div role="tablist" className="flex border-b">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          onClick={() => onTabChange(tab.id)}
          className={activeTab === tab.id ? 'border-b-2 border-indigo-600' : ''}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

---

## 📝 Semantic HTML

### Use Semantic Elements

```tsx
// ✅ Good: Semantic HTML
<header>Header content</header>
<nav>Navigation links</nav>
<main>Main content</main>
<article>Article content</article>
<aside>Sidebar content</aside>
<footer>Footer content</footer>

<button>Click me</button>
<a href="/page">Link</a>
<input type="text" />
<label htmlFor="input-id">Label text</label>

// ❌ Bad: Using divs for everything
<div className="header">Header content</div>
<div className="nav">Navigation links</div>
<div className="main">Main content</div>
<div onClick={...}>Click me (not keyboard accessible)</div>
```

### Form Structure

```tsx
// ✅ Good: Proper form structure
<form>
  <div>
    <label htmlFor="email">Email *</label>
    <input 
      id="email" 
      type="email" 
      required
      aria-describedby="email-error"
    />
    {error && <span id="email-error" className="text-red-600">{error}</span>}
  </div>
  <button type="submit">Submit</button>
</form>

// ❌ Bad: Missing labels, unclear structure
<form>
  <div>
    <input placeholder="Email" />
    <span>{error}</span>
  </div>
  <div onClick={...}>Submit</div>
</form>
```

---

## 🧪 Testing Checklist

### Keyboard Navigation
- [ ] All buttons are focusable (Tab key)
- [ ] Tab order matches visual order (left-to-right, top-to-bottom)
- [ ] Can activate buttons with Enter/Space
- [ ] Can close modals with Escape key
- [ ] Focus ring is visible for all interactive elements
- [ ] No keyboard traps (user can always move away)

### Screen Reader
- [ ] Page structure makes sense with headings (h1, h2, h3)
- [ ] Buttons have descriptive labels
- [ ] Form inputs have associated labels
- [ ] Modal title and description announced
- [ ] Status changes announced (aria-live)
- [ ] Decorative elements hidden (aria-hidden="true")
- [ ] Image alt text is descriptive

### Color & Contrast
- [ ] Color is not the only way to convey information
- [ ] Text contrast is >= 4.5:1
- [ ] Error states visible (color + icon)
- [ ] Works in high contrast mode

### Mobile & Responsive
- [ ] Touch targets are >= 44x44px
- [ ] Content reflows on narrow screens
- [ ] Text is legible at 200% zoom
- [ ] No horizontal scrolling on small screens

---

## 🔄 Implementation Pattern

### Before Refactoring
```tsx
<div onClick={handleClick} className="cursor-pointer">
  <SearchIcon /> {/* No label */}
</div>

<div className="sidebar">
  <input placeholder="Search" /> {/* No label */}
  {error && <p className="text-gray-400">{error}</p>} {/* Low contrast */}
</div>
```

### After Refactoring
```tsx
<button 
  onClick={handleClick}
  aria-label="Search for routes"
  className="focus:outline-2 focus:outline-indigo-600"
>
  <SearchIcon />
</button>

<aside className="sidebar" role="navigation" aria-label="Dashboard">
  <label htmlFor="search-input" className="sr-only">Search routes</label>
  <input 
    id="search-input"
    type="search"
    placeholder="Search routes"
    aria-describedby="search-hint"
  />
  {error && (
    <p 
      id="search-hint"
      className="text-red-600" 
      role="alert"
    >
      {error}
    </p>
  )}
</aside>
```

---

## 📚 Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools Browser Extension](https://www.deque.com/axe/devtools/)
- [Tailwind Accessibility](https://tailwindcss.com/docs/accessibility)

---

**Version**: 1.0.0  
**Created**: 2026-05-25  
**Compliance Level**: WCAG 2.1 AA
