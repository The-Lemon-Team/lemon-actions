---
name: Lemon Actions
colors:
  surface: '#fbf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#fbf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ef'
  surface-container: '#efeeea'
  surface-container-high: '#eae8e4'
  surface-container-highest: '#e4e2de'
  on-surface: '#1b1c1a'
  on-surface-variant: '#4d4633'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f0ed'
  outline: '#7e7761'
  outline-variant: '#d0c6ac'
  surface-tint: '#715d00'
  primary: '#715d00'
  on-primary: '#ffffff'
  primary-container: '#f7d02c'
  on-primary-container: '#6c5900'
  inverse-primary: '#e9c31c'
  secondary: '#745b00'
  on-secondary: '#ffffff'
  secondary-container: '#fecf2e'
  on-secondary-container: '#705900'
  tertiary: '#565e74'
  on-tertiary: '#ffffff'
  tertiary-container: '#cbd2ec'
  on-tertiary-container: '#525a70'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffe176'
  primary-fixed-dim: '#e9c31c'
  on-primary-fixed: '#221b00'
  on-primary-fixed-variant: '#554500'
  secondary-fixed: '#ffe089'
  secondary-fixed-dim: '#efc11c'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574400'
  tertiary-fixed: '#dae2fd'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3f465c'
  background: '#fbf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2de'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
  label-code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-ui:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies Warm Modernism tailored for developer infrastructure, orchestrations, and mission-critical workflows. By harmonizing an inviting cream background with an unmistakable radiant lemon accent, it transforms dense architectural automation interfaces into human, energetic, and highly readable workspaces.

The visual style blends crisp technical utility with mid-century print warmth:
- **Atmospheric Palette:** Warm off-whites and tactile cream backgrounds reduce eye fatigue during extended terminal and browser sessions.
- **Precision Typography:** Monospaced data tags and state identifiers anchor structured orchestration logic alongside robust modern grotesque typography.
- **Warm Modern Structural Rhythm:** Elevated card layers, gentle hairline borders, and energetic lemon focus indicators keep interactive nodes tactile without clinical sterility.

## Colors

The color palette centers on radiant citrus energy against a tactile, non-glare cream foundation:

- **Primary Accent (`#F7D02C`):** Vibrant lemon yellow. Reserved for high-value interactive anchors, active tabs, primary CTAs, and system focus boundaries.
- **Secondary Accent (`#E5B80B`):** Warm golden amber. Applied to interactive hover states, contextual emphasis, and primary accent shadows.
- **Deep Slate & Charcoal (`#0F172A`, `#1E293B`):** High-contrast structural ink for headings and running prose, preserving strict AA/AAA contrast ratios against light and yellow backdrops.
- **Muted Slate (`#64748B`):** Supporting metadata, timestamps, secondary labels, and inactive icon states.
- **Backgrounds & Surfaces:**
  - Base Canvas: Warm Cream (`#FBF9F5`)
  - Elevated Worksurfaces & Panels: `#FFFFFF` and Soft Cream-White (`#F7F5F0`)
  - Subdued Dividers & Ghost Borders: Warm stone neutrals (`#EAE6DF`, `#E2DDD3`)
- **Semantic Status Spectrum:**
  - Active / Executing: Emerald Green (`#10B981`) with soft emerald glow.
  - Paused / Pending: Warm Amber (`#F59E0B`).
  - Idle / Complete: Slate Gray (`#64748B`).
  - Terminated / Failed: Crimson Red (`#EF4444`).

## Typography

The type scale combines crisp modernist headings, high-density utilitarian UI text, and an engineered monospace layer:

- **Headings (Hanken Grotesk):** Tight tracking with clean geometric terminal cuts, giving workflow titles and dashboard metrics immediate architectural structure.
- **Body & Controls (Inter):** High x-height and neutral geometry optimized for operational data tables, configuration forms, and multi-column telemetry.
- **Logic & Tags (JetBrains Mono):** Purpose-built for system tokens (`#mutex`, `#fsm`, run IDs, step durations). Always set with reduced font sizes and calibrated line heights to maintain tight table rows.

## Layout & Spacing

This design system uses an adaptable 12-column fluid grid system bounded by maximum container widths to safeguard developer scanning speeds across ultrawide monitors.

- **Grid Alignment:**
  - **Desktop (≥1200px):** 12 columns, 1.5rem (`gutter`), 2rem outer canvas margins (`margin`), max-width 1440px centered layout.
  - **Tablet (768px - 1199px):** 8 columns, 1.25rem gutters, 1.5rem margins. Secondary panels collapse into sliding draw-sheets.
  - **Mobile (<768px):** 4 columns, 1rem gutters, 1rem margins. Side navigation transitions to an off-canvas drawer or a sticky bottom control bar.
- **Internal Spacing Rules:** Components follow strict 4px / 8px multiples. Metrics and logic flow trees use compact spacing (`space-xs` through `space-md`), while container padding defaults to `space-lg` to create clear macro zones.

## Elevation & Depth

Visual hierarchy uses warm tonal layering paired with soft diffuse contact shadows:

- **Base Layer (Level 0):** Canvas set to Warm Cream (`#FBF9F5`) with no shadows.
- **Container Layer (Level 1):** Main dashboard cards, canvas nodes, and tables on `#FFFFFF` or `#F7F5F0`, framed by a 1px border of `#EAE6DF`. Rendered with a warm ambient drop shadow: `0 1px 3px rgba(30, 41, 59, 0.04), 0 4px 12px rgba(226, 221, 211, 0.3)`.
- **Raised & Overlay Layer (Level 2):** Flyouts, dropdown panels, contextual inspectors, and hovering execution rows use `#FFFFFF`, a 1px border of `#E2DDD3`, and depth: `0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.02)`.
- **Status Aura (Glow Effect):** Status indicators utilize color-matched radial halo glows (e.g., active nodes use `box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15)`).
- **Primary Interactive Focus:** Sharp outer ring tinted with the lemon highlight: `0 0 0 3px rgba(247, 208, 44, 0.45)`.

## Shapes

The interface balances soft friendliness with structured technical utility:

- **Base Radii (`roundedness: 2` / 0.5rem):** Form inputs, buttons, logic nodes, and table action triggers.
- **Macro Enclosures (`rounded-xl` / 1.5rem):** Dashboard cards, log viewers, orchestration timeline boxes, and elevated modals.
- **Micro Tags & Badges (Pill / Full Rounded):** Status chips, concurrency tags, logic type labels (`#mutex`, `#fsm`), and runtime pills use full `9999px` capsule radii.

## Components

### Buttons
- **Primary:** Background vibrant lemon `#F7D02C`, text `#0F172A` (weight 600), subtle border `1px solid #E5B80B`. Hover shifts background to `#E5B80B`. Active state applies `transform: scale(0.98)`.
- **Secondary / Outline:** Background `#FFFFFF`, text `#1E293B`, border `1px solid #E2DDD3`. Hover shifts background to `#F7F5F0` and border to `#D6D0C4`.
- **Ghost:** No border or initial background; hover gains `#F7F5F0` with text `#0F172A`.

### Status Badges & Pill Chips
- **Pill Tags:** Enclosed with `rounded-full`, 4px vertical / 10px horizontal padding.
- **Active Badge:** Emerald light fill (`#ECFDF5`), deep emerald text (`#065F46`), leading 6px pulsing dot with emerald glow ring.
- **Paused / Queued Badge:** Amber fill (`#FFFBEB`), amber text (`#92400E`), steady 6px amber dot.
- **Idle Badge:** Slate tint (`#F1F5F9`), slate text (`#475569`), solid neutral dot.
- **Logic Tag Chips:** Rendered in `label-code-sm` JetBrains Mono on `#F7F5F0` background with `#EAE6DF` hairline outline. E.g., `#mutex`, `#fsm`, `#cron`.

### Input Fields & Search Bars
- Background `#FFFFFF`, border `1px solid #E2DDD3`, text `#0F172A`, placeholder `#64748B`.
- Focus state highlights with a 1px border of `#E5B80B` and an outer halo: `0 0 0 3px rgba(247, 208, 44, 0.3)`.

### Cards & Action Panels
- Structured with `rounded-xl` (1.5rem radius), `#FFFFFF` fill, 1px `#EAE6DF` border.
- Header bars within cards incorporate a gentle bottom separator `#F7F5F0` with uppercase tracking for subheads.

### Tables & Run Logs
- Alternating subtle rows using `#FFFFFF` and `#FBF9F5`.
- Monospaced timestamp and duration columns anchored to tabular numerals.
- Hovering a run row highlights with a soft lemon tint: `rgba(247, 208, 44, 0.08)` and reveals contextual quick-action buttons.