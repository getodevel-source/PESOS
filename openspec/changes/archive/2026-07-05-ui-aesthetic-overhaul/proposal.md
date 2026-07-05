# Proposal: UI Aesthetic Overhaul

## Intent
Revamp the application's user interface to a premium cyberpunk/neon-retro aesthetic with tactile controls, glassmorphic panels, glowing status indicators, and smooth micro-interactions, utilizing design tokens in Tailwind v4.

## Scope
### In Scope
- Define CSS custom variables and semantic utility classes for glassmorphic elements, tactile feedback, and glows inside `@theme` in `globals.css` (Approach 1).
- Visual overhaul of components (tactile controls, neon glows, glass surfaces, transitions):
  - `globals.css` (Theme tokens, glass-premium, btn-tactile, glows)
  - `Dashboard.tsx` (Sidebar layout, user level RPG card, tab/updater buttons)
  - `TaskList.tsx` & `HabitList.tsx` (Item containers, action buttons, checklist animation)
  - `DietLog.tsx` (Neon glowing progress status bars, tactile quick-add)
  - `JournalReflection.tsx` (Mood selector buttons, tactile tag switches, textareas)
  - `TransactionSummary.tsx` (Premium ledger cards, neon badges, tables)
  - `ChatBot.tsx` (AI status indicators, conversation balloons, settings panel)
### Out of Scope
- Functional modifications or new backend capabilities.
- Structural layout changes that break existing page routes or data pipelines.
- Replacing Tailwind v4 with a different styling framework.

## Capabilities
### New Capabilities
- None
### Modified Capabilities
- None (This is a pure UI refactor, no specification-level requirement is changing).

## Approach
- **Approach 1**: Define theme tokens and custom utility classes inside `@theme` in `globals.css` using Tailwind v4.
- Apply semantic utilities (`.glass-premium`, `.btn-tactile`, `.glow-accent`) across React components to keep components clean, synchronized, and easily maintainable.
- Enforce visual contrast (WCAG standards) and restrict backdrop blurs to avoid frame drops in Electron runtime.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/app/globals.css` | Modified | Define global theme tokens, animations, and tactile/glass utility styles. |
| `src/components/Dashboard.tsx` | Modified | Overhaul sidebar layout, RPG stats card, tab switches, and updater buttons. |
| `src/components/TaskList.tsx` / `HabitList.tsx` | Modified | Visual polish of containers, lists, tactile action buttons, and complete state animations. |
| `src/components/DietLog.tsx` | Modified | Custom neon gradient progress bars, tactile buttons, and glassmorphic inputs. |
| `src/components/JournalReflection.tsx` | Modified | Glowing mood selectors, tactile tag switches, and glass textarea. |
| `src/components/TransactionSummary.tsx` | Modified | Credit card style ledger elements, glowing alert badges, and premium table layouts. |
| `src/components/ChatBot.tsx` | Modified | Glowing status indicators, conversation bubble visual polish, and settings transitions. |

## Risks
- **Performance**: High backdrop blur density inside Electron may cause lag. *Mitigation*: Restrict nested/multiple backdrop blurs.
- **Readability**: Glowing/transparent backgrounds might compromise contrast. *Mitigation*: Validate foreground/background colors against WCAG AAA/AA targets.

## Rollback Plan
- Revert via Git to the commit before the UI overhaul branch integration.

## Dependencies
- Tailwind v4 and React 19 / Next.js 16 (No new npm dependencies needed).

## Success Criteria
- [ ] Application compiles without errors (`npm run build`).
- [ ] No functional regression in interactive flows (tabs, forms, AI chat, lists, db operations).
- [ ] All target files adopt the new design system tokens and utilities.
- [ ] Render performance remains stable (≥ 60 FPS on standard desktop environments).
