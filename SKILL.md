# Bus Booking Platform - Reusable Development Skills

> Production-ready skills for UI/UX development, testing, code review, and quality assurance.

## 🎯 Skill Categories

### 1. UI Component Development

#### Skill: Design Token Application
**Purpose:** Apply consistent colors, typography, spacing, and animations

**Steps:**
1. Identify component color needs
2. Map to design tokens: `indigo-600`, `slate-600`, `emerald-600`, `red-600`, `amber-600`
3. Use Tailwind utilities, never hardcode colors
4. Apply spacing with 4px grid: `px-4`, `py-3`, `gap-2`
5. Add animations with `transition-all duration-150`
6. Verify contrast ratio WCAG AA (4.5:1 minimum)

#### Skill: Responsive Component Design
**Purpose:** Build components that work from 320px (mobile) to 1920px (desktop)

**Steps:**
1. Mobile-first approach: design for 320px first
2. Test breakpoints: 320px, 768px, 1024px, 1920px
3. Use Tailwind responsive prefixes: `md:`, `lg:`, `xl:`
4. Stack content vertically on mobile, horizontal on desktop
5. Adjust padding/margins: less on mobile, more on desktop
6. Test touch targets (min 44px x 44px on mobile)

#### Skill: Loading & Error State Implementation
**Purpose:** Provide clear visual feedback for async operations

**Steps:**
1. **Loading:** Use skeleton loader for content loading
2. **Action Loading:** Use button spinner for form submissions
3. **Error:** Display inline errors for forms, toast for API errors
4. **Retry:** Always provide retry option on error
5. **Empty:** Show contextual empty state
6. **Recovery:** Error boundary for fatal errors

#### Skill: Accessible Component Building
**Purpose:** Ensure keyboard navigation, screen reader support, color contrast

**Steps:**
1. Add ARIA labels to interactive elements
2. Implement keyboard navigation (Tab, Enter, Escape)
3. Verify color contrast (WCAG AA 4.5:1 minimum)
4. Use semantic HTML (button, input, nav, main)
5. Support focus indicators (visible outline)

### 2. Dashboard-Specific Patterns

#### Skill: Tab Navigation Standardization
**Purpose:** Implement consistent tab patterns

**Steps:**
1. Use Radix UI Tabs for accessibility
2. Show active tab with `border-indigo-600` bottom border
3. Add badge count to tabs if applicable
4. Implement tab icons from Lucide React
5. Smooth tab transition
6. Keyboard navigation: Arrow keys for tab switching

#### Skill: Data Table Standardization
**Purpose:** Build consistent, feature-rich data tables

**Features Required:**
- Sorting by column
- Search/filter
- Pagination
- Row selection with checkboxes
- Bulk actions
- Column visibility toggle
- Loading skeleton
- Empty state

#### Skill: Modal/Dialog Standardization
**Purpose:** Implement consistent modal patterns

**Steps:**
1. Use Radix UI Dialog
2. Header with title and close button
3. Body with main content (scrollable)
4. Footer with action buttons
5. Backdrop click closes modal
6. Escape key closes modal
7. Focus trap inside modal
8. Animation: fade-in 150ms

#### Skill: Form Validation & Error Handling
**Purpose:** Standardize form behavior

**Pattern:**
1. Use React Hook Form
2. Validate on blur (not real-time)
3. Show inline errors below field
4. Required fields: red asterisk
5. Success state: green checkmark
6. Disabled state: gray background
7. Submit button: show spinner
8. Success message: toast notification

#### Skill: Status Indicator Standardization
**Purpose:** Use consistent color-coding for trip/booking status

**Colors:**
1. Pending: `amber-500`
2. Confirmed: `blue-600`
3. In Progress: `indigo-600`
4. Completed: `emerald-600`
5. Cancelled: `red-600`
6. No Show: `slate-600`

### 3. Testing & Quality Assurance

#### Skill: Component Unit Testing
**Purpose:** Write testable, maintainable tests

**Steps:**
1. Test component renders with default props
2. Test component renders with variant props
3. Test user interactions
4. Test error state handling
5. Test loading state display
6. Mock external dependencies
7. Check for accessibility issues

#### Skill: Integration Testing
**Purpose:** Test components in dashboard context

**Steps:**
1. Test with real context
2. Test data flow
3. Test state management
4. Test form submission workflow
5. Test error recovery
6. Test loading to loaded transitions

#### Skill: Accessibility Testing
**Purpose:** Verify WCAG 2.1 AA compliance

**Tests:**
1. Keyboard navigation (Tab, Enter, Escape)
2. Screen reader announcements
3. Color contrast (4.5:1 minimum)
4. Focus indicators (visible outline)
5. Semantic HTML validation
6. Form label associations

### 4. Code Review & Quality

#### Skill: Code Review for UI Standards
**Purpose:** Ensure code meets project standards

**Checklist:**
- [ ] TypeScript strict mode (no `any` types)
- [ ] Design tokens used
- [ ] Responsive design
- [ ] Keyboard accessible
- [ ] Loading states implemented
- [ ] Error states with retry
- [ ] Empty states contextual
- [ ] ARIA labels present
- [ ] No console warnings/errors
- [ ] Tests included
- [ ] Comments explain WHY
- [ ] Lint passes
- [ ] Build succeeds

#### Skill: Performance Optimization
**Purpose:** Keep dashboards fast

**Techniques:**
1. Code Splitting: Lazy load tabs
2. Memoization: React.memo()
3. Image Optimization: Next.js Image
4. Data Fetching: Caching, pagination
5. Bundle Size: Check with build stats
6. Lighthouse: Aim for >90 performance

### 5. Git & Commit Best Practices

#### Skill: Atomic Commit Creation
**Purpose:** Write clear, reviewable git history

**Format:**
```
feat(scope): concise description

Extended description explaining WHY.

- Bullet point 1
- Bullet point 2

Closes #issue-number
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

#### Skill: Branch Strategy
**Purpose:** Organize feature development

**Naming:**
```
feat/component-name
fix/bug-description
refactor/component-extraction
docs/section-topic
test/feature-name
chore/dependency-update
```

---

**Version:** 1.0.0  
**Last Updated:** 2026-05-25
