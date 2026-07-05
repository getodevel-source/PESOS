# Design: UI Aesthetic Overhaul (ui-aesthetic-overhaul)

## 1. Technical Approach
We will refactor the PESOS visual interface to a premium cyberpunk/neon-retro aesthetic. This is achieved by defining custom theme tokens and global utility classes inside `globals.css` using Tailwind v4. The TSX components will consume these semantic classes directly to maintain styling consistency, clean markup, and easy updates.

We will focus on:
- Defining CSS variable tokens for glows and fallback layers inside `@theme`.
- Creating global utilities: `.glass-premium` for glassmorphic containers, `.btn-tactile` for depth changes on click, and status glow shadows (`.glow-habit`, `.glow-transaction`, `.glow-task`).
- Applying theme tokens and visual overrides across all 7 target component files.

---

## 2. Architecture Decisions

### Decision 1: Dark Glassmorphic Utility (`.glass-premium`)
- **Choice**: Standardize on a single utility class inside `globals.css` rather than scattered inline classes.
- **Rationale**: Keeps the codebase uniform. If design parameters (border opacity, blur radius) change, it only needs to be updated in one place.
- **Fallback Policy**: We specify a fallback solid background (`--bg-glass-fallback`) to automatically display when the platform does not support hardware acceleration or backdrop blending.

### Decision 2: Tactile click states (`.btn-tactile`)
- **Choice**: Use CSS active states with vertical translation (`translate-y-[1px]` or `translate-y-[2px]`) and slight shadow reductions.
- **Rationale**: Provides direct visual feedback resembling physical button clicks, improving tactile satisfaction.

### Decision 3: Contextual Status Glows
- **Choice**: Implement `box-shadow` values using Tailwind v4 custom theme styles.
- **Rationale**: Reuses Tailwind's theme system and keeps the component styling readable. We map Green/Habits, Blue/Transactions, and Purple/Tasks to respective glowing variables.

---

## 3. Data Flow
The change is purely visual; no state-management or backend data pipeline modifications are made. The render flow is:
```
[Database/State] ──> [Component TSX] ──(Utility Classes)──> [Tailwind v4 / CSS Variables]
```

---

## 4. File Changes

### 4.1. `src/app/globals.css`
- Define tokens inside `@theme`:
  - Glow colors: `--color-glow-green` (`#10b981`), `--color-glow-blue` (`#3b82f6`), `--color-glow-purple` (`#7c3aed`).
  - Glass variables: `--bg-glass-color`, `--glass-blur-radius`, `--glass-border-color`, and `--bg-glass-fallback`.
- Add utility definitions:
  - `.glass-premium`: Semi-transparent background with backdrop filter blur (12px), border, and fallback support.
  - `.btn-tactile`: Active click transformations (`active:translate-y-[1px] active:scale-[0.98]`).
  - Custom keyframes:
    - `avatar-breathing`: breathing border border-color pulse animation.
    - `progress-glow-pulse`: level progress bar glow pulse.
    - `check-glow`: animation for complete item indicators.

### 4.2. `src/components/Dashboard.tsx`
- **Sidebar Tab Glows**: Update active tab states to use subtle border colors and box shadows matching their respective category glows.
- **Level Radial/Progress**: Add a subtle glow highlight and progress pulse animation on the XP bar.
- **Update Button Visual State**: Apply `.btn-tactile` and glowing hover transitions on the "Buscar actualizaciones" button.

### 4.3. `src/components/TaskList.tsx` & `HabitList.tsx`
- **Checklist Items**: Redesign list row cards with `.glass-premium` borders. Add completion animation and glowing check states.
- **Glowing Status Indices**: Glowing indicators for active tasks (purple glows) and daily habit completion check circles (green glows).

### 4.4. `src/components/DietLog.tsx`
- **Status Gradients**: Overhaul the macro target progress bars to use vivid glowing gradient tracks.
- **Tactile Inputs**: Set quick-add food badges and water add buttons to use `.btn-tactile` click states.

### 4.5. `src/components/JournalReflection.tsx`
- **Tactile Tags**: Convert mood buttons and selector tag switches into tactile toggle cards.
- **Mood Glows**: Highlight selected mood emojis with an active colored glow ring.

### 4.6. `src/components/TransactionSummary.tsx`
- **Card Ledger**: Redesign total balance, income, and expense cards to look like premium credit card panels with glowing borders.
- **Glow Alerts**: Highlight budget status changes (warning/critical) with glowing red/amber alert banners.

### 4.7. `src/components/ChatBot.tsx`
- **Avatar breathing border**: Animate the AI chat avatar border with a slow breathing cyan/purple glow.
- **Speech Bubbles**: Update text balloons with custom border radii and glassmorphic opacity levels.

---

## 5. Interfaces/Contracts

### Design Tokens (CSS Variables)
- `--color-glow-green`: `rgba(16, 185, 129, 0.4)`
- `--color-glow-blue`: `rgba(59, 130, 246, 0.4)`
- `--color-glow-purple`: `rgba(124, 58, 237, 0.4)`
- `--bg-glass-fallback`: `rgb(13, 17, 23)`
- Animations: `avatar-breathing`, `progress-glow-pulse`, `check-glow`

---

## 6. Testing Strategy

### Build Verification
- Compile application using `npm run build` to ensure all custom CSS definitions and TSX changes conform to Tailwind v4 and React 19 rules.

### Manual Visual Scenarios
- **Glassmorphism Fallback**: Test in a performance-simulated environment to confirm backdrop blur fallback functions correctly.
- **Active Click Transformation**: Manually click buttons across the dashboard to ensure the vertical transition occurs on active state.
- **Contrast Ratios**: Inspect text colors to confirm compliance with WCAG AA (minimum 4.5:1 ratio) on glass surfaces.

---

## 7. Rollout/Migration
There is no database migration required as the schema is unchanged. Reverting can be executed via standard Git rollback.
