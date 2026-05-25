# Copilot CLI Instructions - Bus Booking Platform

> Directives for GitHub Copilot to maintain code quality and standards

## 🎯 Code Generation Standards

### Always Apply These Rules

#### TypeScript & Type Safety
```
1. Always use strict TypeScript (no 'any' types)
2. Provide explicit return types for functions
3. Use interfaces for component props
4. Validate all external data with Zod
5. Handle null/undefined explicitly
```

#### Component Structure
```
'use client'

import { ... }
import type { ComponentProps } from '@/types'

interface Props { ... }

export function Component({ ... }: Props) {
  // Implementation
}

export { Component }
```

#### Styling
```
1. Use Tailwind CSS utilities (no inline styles)
2. Use design tokens from tailwind.config.ts
3. Never hardcode colors
4. Apply 4px spacing grid
5. Use consistent animations (150ms-300ms)
```

#### Error Handling
```
1. Always provide error boundaries around async operations
2. Show user-friendly error messages
3. Include retry buttons for failed operations
4. Log errors for debugging
5. Handle network failures gracefully
```

#### Testing
```
1. Include unit tests for all components
2. Test happy path and error scenarios
3. Test accessibility (keyboard, ARIA)
4. Aim for >80% code coverage
5. Use descriptive test names
```

### Never Do This

```
❌ Use hardcoded colors: { backgroundColor: '#4f46e5' }
❌ Use inline styles instead of Tailwind
❌ Use 'any' type in TypeScript
❌ Leave console.log() in production code
❌ Create components without tests
❌ Skip error handling in async operations
❌ Hardcode magic numbers/values
❌ Create large files (>300 lines)
❌ Forget ARIA labels on interactive elements
❌ Commit without clear message
```

## 🚀 Common Task Templates

### Task: Create New UI Component
```
1. Create file: src/components/ui/component-name.tsx
2. Import from Radix UI if needed
3. Define TypeScript interface for props
4. Implement component with TypeScript
5. Use design tokens for styling
6. Add ARIA labels
7. Write unit tests
8. Export both named and default
9. Document with JSDoc comment
```

### Task: Add Feature to Dashboard
```
1. Create branch: feat/feature-name
2. Add route/page if new page
3. Create components in _components/ dir
4. Use existing dashboard components
5. Add loading + error states
6. Implement form validation if needed
7. Write integration tests
8. Update navigation/breadcrumbs
9. Commit with atomic message
```

### Task: Fix Bug in Component
```
1. Create branch: fix/bug-description
2. Write test that reproduces bug
3. Fix the bug
4. Verify test passes
5. Check for related bugs
6. Commit with clear message
7. Reference issue number
```

### Task: Refactor Component
```
1. Create branch: refactor/component-name
2. Keep current functionality
3. Apply design standards incrementally
4. Keep existing tests passing
5. Add new tests if coverage improves
6. Commit explaining changes
7. Note: refactoring PRs should be separate
```

## 🎨 Design Token Reference

### Colors (Use These)
```
Primary Actions:    indigo-600
Success Messages:   emerald-600
Error/Destructive:  red-600
Warnings:           amber-600
Info Messages:      blue-600
Secondary Text:     slate-600
Borders:            slate-200
Background:         slate-50
Surface:            white
```

### Spacing (Use These)
```
4px:  px-1, py-1, gap-1
8px:  px-2, py-2, gap-2
12px: px-3, py-3, gap-3
16px: px-4, py-4, gap-4
24px: px-6, py-6, gap-6
32px: px-8, py-8, gap-8
48px: px-12, py-12, gap-12
```

### Typography (Use These)
```
Page Title:      font-bold text-3xl
Section Header:  font-bold text-2xl
Subsection:      font-bold text-xl
Body Text:       font-regular text-base
Small Text:      font-regular text-sm
Label:           font-medium text-sm
Caption:         font-regular text-xs
```

### Animations (Use These)
```
Fast:     duration-150
Standard: duration-200
Slow:     duration-300
Easing:   transition-colors, transition-all
```

## 📝 Commit Message Format

```
type(scope): concise description (50 chars max)

Extended description explaining the change and WHY.
Wrap at 72 characters.

- Bullet point 1
- Bullet point 2
- Bullet point 3

Closes #issue-number
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

### Commit Types
- `feat`: New feature/component
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation update
- `test`: Test additions
- `style`: Formatting/linting
- `chore`: Build, dependencies, config

## ✅ Pre-Commit Checklist

```bash
# Type check
npm run build

# Lint
npm run lint

# Tests
npm run test

# Manual checks
- No console.log() in code
- No console errors in browser
- Responsive (320px, 768px, 1920px)
- Keyboard navigation works
- Loading states visible
- Error states shown
```

## 🧪 Testing Expectations

### Every Component Should Have Tests For:
```
1. Rendering with default props
2. Rendering with variant props
3. User interactions
4. Error state handling
5. Loading state display
6. Accessibility (keyboard, ARIA)
```

### Every Feature Should Have Tests For:
```
1. Happy path (success scenario)
2. Error scenario
3. Edge cases
4. User workflow
```

### Every Page Should Have:
```
1. Loading skeleton
2. Error boundary
3. Empty state display
4. Successful data display
```

## 🔍 Code Review Points

When reviewing code, check for:

```
TypeScript:
  ✓ No 'any' types
  ✓ Explicit return types
  ✓ Proper type narrowing

Design:
  ✓ Design tokens used
  ✓ No hardcoded colors
  ✓ Consistent spacing
  ✓ Responsive layout

UX:
  ✓ Loading states
  ✓ Error handling
  ✓ Empty states
  ✓ Status indicators

Accessibility:
  ✓ ARIA labels present
  ✓ Keyboard navigation works
  ✓ Color contrast WCAG AA

Quality:
  ✓ Tests included
  ✓ No console errors
  ✓ Lint passes
  ✓ Comments explain WHY

Git:
  ✓ Atomic commits
  ✓ Clear messages
  ✓ Related to issue
```

## 📚 Key Resources

- `.instructions.md` - Development standards
- `.agent.md` - Custom agent configuration
- `SKILL.md` - Reusable development skills
- `src/components/ui/` - UI component library
- `tailwind.config.ts` - Design tokens
- `tsconfig.json` - TypeScript settings
- `eslint.config.mjs` - Lint rules

## 🎯 Special Guidelines for Each Dashboard

### Operator Dashboard
- 7 tabs: Dashboard, Trips, Bookings, Routes, Buses, Reports, Profile
- Unified header with search, notifications, profile menu
- Data tables with sorting, filtering, pagination
- Status badges for trip status

### Conductor Dashboard
- 5 core features: Dashboard, My Trips, Payments, Reports, Profile
- Trip selection interface
- Real-time status indicators
- Modals: Walk-on booking, Scanner, Cash collection

### Company Admin Dashboard
- Sidebar navigation
- Company management
- Operators management
- Analytics and reporting

---

**Version:** 1.0.0  
**Last Updated:** 2026-05-25
