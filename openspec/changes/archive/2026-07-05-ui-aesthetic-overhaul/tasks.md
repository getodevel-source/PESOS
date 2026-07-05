# Tasks: UI Aesthetic Overhaul

Decision needed before apply: No
Chained PRs recommended: No (User requested Single PR size-exception)
Chain strategy: size-exception
400-line budget risk: High

## Workload Forecast & PR Split
- **PR 1**: `src/app/globals.css` (CSS Foundation & tokens)
- **PR 2**: `src/components/Dashboard.tsx` (Sidebar & layouts)
- **PR 3**: `src/components/TaskList.tsx` & `src/components/HabitList.tsx` (Lists)
- **PR 4**: `src/components/DietLog.tsx` & `src/components/JournalReflection.tsx` (Inputs/Glows)
- **PR 5**: `src/components/TransactionSummary.tsx` & `src/components/ChatBot.tsx` (Finance/Chat)

## Phase 1: CSS Foundation
- [x] Task 1.1: Define Tailwind v4 design tokens inside `@theme` in `src/app/globals.css` for `--color-glow-green`, `--color-glow-blue`, `--color-glow-purple`, `--bg-glass-fallback`.
- [x] Task 1.2: Add utility classes `.glass-premium` (with backdrop-filter blur & fallback) and `.btn-tactile` (with active translations).
- [x] Task 1.3: Define custom keyframes `avatar-breathing`, `progress-glow-pulse`, and `check-glow`.

## Phase 2: Sidebar & Core Layout
- [x] Task 2.1: Apply active tab glows and tactile selectors in sidebar of `src/components/Dashboard.tsx`.
- [x] Task 2.2: Add progress glow pulse to RPG XP bar in `src/components/Dashboard.tsx`.
- [x] Task 2.3: Overhaul the "Buscar actualizaciones" button with `.btn-tactile` and glowing transitions.

## Phase 3: List Elements
- [x] Task 3.1: Apply `.glass-premium` and custom border classes to tasks in `src/components/TaskList.tsx`.
- [x] Task 3.2: Implement completion checklist animations with `check-glow` and purple indicators.
- [x] Task 3.3: Visual update of habits list containers to `.glass-premium` in `src/components/HabitList.tsx`.
- [x] Task 3.4: Add green status glow indicators for completed daily habits.

## Phase 4: Activity & Health Cards
- [x] Task 4.1: Replace standard progress bars in `src/components/DietLog.tsx` with neon gradient tracks.
- [x] Task 4.2: Apply `.btn-tactile` to quick-add foods and water buttons in `src/components/DietLog.tsx`.
- [x] Task 4.3: Implement glowing mood selector buttons and active glows in `src/components/JournalReflection.tsx`.
- [x] Task 4.4: Style tag switches with `.btn-tactile` toggles in `src/components/JournalReflection.tsx`.

## Phase 5: Finance & Assistant
- [x] Task 5.1: Redesign ledger panels to premium cards with glowing borders in `src/components/TransactionSummary.tsx`.
- [x] Task 5.2: Apply glowing warning/critical alert badges to budget status in `src/components/TransactionSummary.tsx`.
- [x] Task 5.3: Add avatar-breathing cyan/purple glow animation to AI avatar in `src/components/ChatBot.tsx`.
- [x] Task 5.4: Style chat balloons with glassmorphic opacity levels and custom rounded corners.

## Phase 6: Build & Verification
- [x] Task 6.1: Run `npm run build` to verify Tailwind v4 config, CSS tokens, and component files compile without warnings.
- [x] Task 6.2: Manually check contrast ratios on text elements over glass components (WCAG AA compliance).
- [x] Task 6.3: Verify active button shifts and glassmorphic fallback rendering in standard desktop modes.
