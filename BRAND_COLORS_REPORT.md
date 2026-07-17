# TibhukeBus Brand Colors Report
**Generated:** 2026-07-10

---

## 1. CSS Custom Properties (OKLCh Color Space)

### Light Theme (`:root`)
Defined in `src/app/globals.css`

| Property | OKLCh Value | Usage |
|----------|-----------|-------|
| **Primary** | `oklch(0.205 0 0)` | Dark charcoal/black |
| **Primary Foreground** | `oklch(0.985 0 0)` | Off-white text |
| **Secondary** | `oklch(0.97 0 0)` | Light gray |
| **Secondary Foreground** | `oklch(0.205 0 0)` | Dark text |
| **Accent** | `oklch(0.97 0 0)` | Light accent |
| **Accent Foreground** | `oklch(0.205 0 0)` | Dark accent text |
| **Background** | `oklch(1 0 0)` | Pure white |
| **Foreground** | `oklch(0.145 0 0)` | Near-black text |
| **Destructive** | `oklch(0.577 0.245 27.325)` | Red/destructive |
| **Border** | `oklch(0.922 0 0)` | Light border gray |
| **Input** | `oklch(0.922 0 0)` | Input background |
| **Ring** | `oklch(0.708 0 0)` | Focus ring (medium gray) |

### Dark Theme (`.dark`)
| Property | OKLCh Value | Usage |
|----------|-----------|-------|
| **Primary** | `oklch(0.922 0 0)` | Light text |
| **Primary Foreground** | `oklch(0.205 0 0)` | Dark background |
| **Secondary** | `oklch(0.269 0 0)` | Dark card |
| **Destructive** | `oklch(0.704 0.191 22.216)` | Bright red |

### Sidebar Colors
| Property | Light | Dark |
|----------|-------|------|
| **Sidebar Background** | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| **Sidebar Foreground** | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| **Sidebar Primary** | `oklch(0.205 0 0)` | `oklch(0.488 0.243 264.376)` |
| **Sidebar Accent** | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |

### Chart Colors (Data Visualization)
| Chart | OKLCh Value | Visual |
|-------|-----------|--------|
| **Chart 1** | `oklch(0.646 0.222 41.116)` | Warm orange/brown |
| **Chart 2** | `oklch(0.6 0.118 184.704)` | Cool blue |
| **Chart 3** | `oklch(0.398 0.07 227.392)` | Deep cool blue |
| **Chart 4** | `oklch(0.828 0.189 84.429)` | Warm yellow |
| **Chart 5** | `oklch(0.769 0.188 70.08)` | Warm orange/amber |

---

## 2. Tailwind Color Palette (Primary Usage)

### Primary/CTAs (Indigo)
- `indigo-600` — Primary button background, interactive elements
- `indigo-700` — Hover state for primary buttons
- `indigo-500` — Accent, secondary highlights
- `indigo-100`, `indigo-50` — Light backgrounds, badges
- **Shadow**: `shadow-indigo-100`, `shadow-indigo-200`

### Secondary (Blue)
- `blue-600` — Alternative primary CTA, auth buttons
- `blue-700` — Hover state
- `blue-100`, `blue-50` — Light backgrounds
- **Shadow**: `shadow-blue-200`, `shadow-blue-500/30`

### Success/Positive (Green/Emerald)
- `green-600`, `green-500` — Success states, active indicators
- `green-100` — Light success background
- `emerald-600` — Secondary accent
- `emerald-100`, `emerald-50` — Success badges, status
- **Usage**: "Confirmed", "Active", live indicators

### Warning/Pending (Amber/Orange)
- `amber-100`, `amber-800` — Warning/pending status
- `orange-100`, `orange-600` — Alerts, "Boarding Now"
- **Usage**: Pending bookings, in-progress states

### Destructive/Error (Red)
- `red-100`, `red-800` — Error backgrounds, cancelled states
- `red-500` — Destructive action indicator
- `red-600` — Delete/cancel button
- **Usage**: Cancellations, errors, no-show

### Neutral Grays
- `gray-50`, `gray-100` — Backgrounds
- `gray-200`, `gray-300` — Borders
- `gray-400`, `gray-500` — Muted text
- `gray-600`, `gray-700` — Primary text (light theme)
- `gray-900` — Headings

### Accent Colors
- `teal-100`, `teal-600` — Accent highlights
- `cyan` — Accent (minimal usage)
- `purple-100`, `purple-700` — Special status

### Translucent/Blurred Backgrounds
- `blue-500/10` — Gradient overlays (blur-3xl)
- `indigo-100/40` — Subtle decorative backgrounds
- `indigo-600/5`, `indigo-600/10` — Hover states on cards

---

## 3. Color Usage by Page/Component

### Authentication Pages (Login, Register)
- **Primary**: `blue-600` (buttons)
- **Accents**: `blue-500` (focus rings)
- **Background Blur**: `blue-500/10` overlays

### Dashboards (Admin, Operator, Conductor)
- **Headers**: `indigo-600` backgrounds
- **Sidebar**: `indigo-600` primary, `indigo-100` hover
- **CTAs**: `indigo-600` with `shadow-indigo-100`
- **Status Badges**: 
  - Active: `green-100 text-green-800`
  - Cancelled: `red-100 text-red-800`
  - Pending: `amber-100 text-amber-800`
  - Confirmed: `emerald-100 text-emerald-800`

### Booking Pages
- **CTAs**: `blue-600`, `indigo-600`
- **Seat Selection**: 
  - Available: `gray-100`
  - Selected: `blue-100 text-blue-700`
  - Reserved: `amber-100 text-amber-700`
  - Blocked: `red-100` (opacity-90)
- **Progress Steps**: `blue-600` active, `green-600` completed

### Payment/Revenue
- **Revenue Cards**: `indigo-600` headers
- **Payment Status**: 
  - Paid: `green-100 text-green-800`
  - Failed: `red-100 text-red-800`
  - Pending: `amber-100 text-amber-800`

### Notifications
- **Alert Icons**: 
  - Success: `green` tones
  - Error: `red-500`
  - Warning: `amber` tones
- **Notification Badge**: `red-500` background

### Trip/Status Indicators
- **Trip Status Badges**:
  - `boarding` → `green-100 text-green-800`
  - `scheduled` → `indigo-50 text-indigo-700`
  - `completed` → `emerald-100 text-emerald-700`
  - `no-show` → `red-100 text-red-800`

---

## 4. Button Styles by Type

### Primary CTAs
```
bg-indigo-600 hover:bg-indigo-700 text-white
shadow-lg shadow-indigo-200
```

### Secondary CTAs
```
bg-blue-600 hover:bg-blue-700 text-white
```

### Ghost/Outline
```
bg-white border border-gray-300 text-gray-700
hover:bg-gray-50
```

### Destructive
```
bg-red-600 text-white hover:bg-red-700
```

### Success/Green
```
bg-green-600 hover:bg-green-500 text-white
```

### With Click Effects (Updated)
```
active:scale-95 active:opacity-95 active:shadow-sm
focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
```

---

## 5. Status/State Color Mapping

| State | Background | Text | Usage |
|-------|-----------|------|-------|
| **Active** | `bg-green-100` | `text-green-800` | Active companies, routes |
| **Inactive** | `bg-red-100` | `text-red-800` | Inactive entities |
| **Confirmed** | `bg-emerald-100` | `text-emerald-800` | Confirmed bookings |
| **Pending** | `bg-amber-100` | `text-amber-800` | Pending payments, actions |
| **Cancelled** | `bg-red-100` | `text-red-800` | Cancelled bookings |
| **Completed** | `bg-blue-100` | `text-blue-800` | Completed trips |
| **No-Show** | `bg-orange-100` | `text-orange-800` | No-show passengers |
| **Boarding** | `bg-amber-100` | `text-amber-700` | Active boarding |

---

## 6. Gradient & Decorative Usage

| Usage | Gradient | Location |
|-------|----------|----------|
| **Hero Section** | `blue-500/10 blur-3xl` | Home, error pages |
| **Background Blur** | `indigo-100/40 blur-[120px]` | Profile page |
| **Sidebar Hover** | `indigo-600/5` → `indigo-600/10` | Card backgrounds |
| **Tour/Modal Accent** | Gradient to-r (blue to indigo) | TourModal slides |

---

## 7. Summary

### Core Brand Palette
- **Primary**: Indigo-600 (Trust, UI control)
- **Secondary**: Blue-600 (Alternative CTA, auth)
- **Success**: Green/Emerald (Positive states)
- **Warning**: Amber/Orange (Attention needed)
- **Error**: Red (Destructive, failures)
- **Neutral**: Gray (Borders, text, backgrounds)

### Design Philosophy
- High contrast for accessibility (WCAG AA)
- OKLCh color space for perceptual consistency
- Light/dark theme support via CSS variables
- Status colors follow convention (green=success, red=error, amber=warning)
- Shadows use primary accent (`indigo-100/200`) for visual hierarchy

---

## 8. Files to Reference

- **CSS Variables**: `src/app/globals.css` (lines 48–92)
- **Tailwind Config**: `tailwind.config.ts` (minimal; extends defaults)
- **Component Examples**:
  - Buttons: `src/components/ui/button.ts`
  - Status badges: `src/lib/schedule-utils.ts` (status-to-color mappings)
  - Dashboard headers: `src/app/company/admin/_components/DashboardHeader.tsx`
  - Trip status: `src/app/company/conductor/dashboard/_components/TripCard.tsx`

---

*End of Report*
