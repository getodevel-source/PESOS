## Exploration: ui-aesthetic-overhaul

### Current State
PESOS is built on Next.js 16.2.9 (App Router), React 19.2.4, and Tailwind v4. The styling uses a dark theme with basic CSS variables defined in `globals.css` and a simple `.glass-panel` overlay utility (which uses 45% dark background opacity, 16px backdrop blur, and a 6% white border). Active states, buttons, progress bars, lists, and tabs rely on standard, flat Tailwind utility classes that lack tactile feedback (depth changes on click), glow effects, or cohesive premium styling. 

### Affected Areas
- `src/app/globals.css` — Needs definition of theme tokens, custom glowing utilities, custom shadow drop-shadow classes, and refined transition speeds/easings.
- `src/components/Dashboard.tsx` — Needs premium layout updates (sidebar, layout cards), improved visual indicators for the user level card/progress, and tactile tabs/update buttons.
- `src/components/TaskList.tsx` & `src/components/HabitList.tsx` — Card redesigns to look like premium containers, adding glowing/tactile item action buttons, and transition enhancements for completions.
- `src/components/DietLog.tsx` — Refined progress trackers with distinct neon glowing status bars (using gradients), tactile quick-add buttons, and glassmorphic inputs.
- `src/components/JournalReflection.tsx` — Mood selector buttons redesigned with distinct glowing hover/active states, tactile tag switches, and glass textareas.
- `src/components/TransactionSummary.tsx` — Premium table and layout, glowing alert banners, tactile income/expense selector, and custom inputs.
- `src/components/ChatBot.tsx` — Interactive conversation elements, glowing AI status indicators, premium settings panel transition, and tactile message bubble styles.

### Approaches
1. **Design Tokens & Semantic Utility Classes (Tailwind v4 + Globals)** — Define specific premium variables inside `@theme` in `globals.css` (e.g. `--color-glow-green`, `--shadow-neon-glow`, premium glass definitions) and semantic custom utility classes (e.g. `.glass-premium`, `.btn-tactile`, `.glow-accent`). Apply them across components.
   - Pros: Keeps TSX components clean; enables globally-synchronized style updates; fully leverages Tailwind v4 theme API.
   - Cons: Requires synchronization between `globals.css` config and the TSX component class applications.
   - Effort: Low-Medium

2. **Component-Level Inline Tailwind Utility Classes** — Apply detailed styling directly in individual components using inline Tailwind classes and arbitrary values (e.g., `shadow-[0_0_20px_rgba(124,58,237,0.15)] active:translate-y-[1px] active:scale-95`).
   - Pros: Keeps changes isolated within component files; no dependency on custom CSS utility naming.
   - Cons: Leads to repetitive class listings; extremely difficult to update global styles or maintain absolute uniformity in glows/glass parameters.
   - Effort: High

### Recommendation
We recommend **Approach 1 (Design Tokens & Semantic Utility Classes)**. It ensures that the glassmorphism parameters (blur, transparency, border opacity) and glowing effects (box-shadow parameters, glow sizes) are synchronized app-wide. Any future design adjustments can be made directly in `globals.css` instead of sweeping through 7+ TSX files.

### Risks
- **Performance degradation**: Multiple backdrop-filter blur layers on slow GPUs (especially inside the Electron container) can lead to frame drops. We should keep blurs clean and avoid unnecessary nested blurs.
- **Readability & Contrast**: High-opacity glows or low-contrast text on semi-transparent backgrounds might violate WCAG contrast guidelines. We must ensure text elements maintain excellent readability.
- **CSS Import Clashes**: Tailwind v4 utilizes `@import "tailwindcss";` rather than the classic configuration file. We must ensure theme variables are structured correctly using Tailwind v4 syntax.

### Ready for Proposal
Yes. The orchestrator should tell the user that the exploration of the codebase is complete, the design system strategies for premium glassmorphism and glows have been analyzed, and we are ready to transition to the Proposal/Design phase to write the specification deltas.
