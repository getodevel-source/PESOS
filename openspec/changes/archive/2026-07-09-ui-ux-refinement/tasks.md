# Tasks: UI/UX Refinement (ui-ux-refinement)

## Review Workload Forecast
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

---

## Phase 1: AI Chat & Client Interception
- [x] **1.1. Update AI system prompt** in [route.ts](file:///home/geto/Proyectos/PESOS/src/app/api/ai-chat/route.ts): Instruct LLM to emit actions like `<run_action>{"type": "create_task", "payload": {...}}</run_action>` and others for transactions, habits, and diet logging.
- [x] **1.2. Implement tag streaming parser** in [ChatBot.tsx](file:///home/geto/Proyectos/PESOS/src/components/ChatBot.tsx): Intercept `<run_action>...</run_action>` tags, execute mutations via the local database client, update state, and strip tags from UI text.
- [x] **1.3. Connect refresh callback** in [Dashboard.tsx](file:///home/geto/Proyectos/PESOS/src/components/Dashboard.tsx): Add `onRefresh` handler and pass it to `ChatBot` to update dashboard widgets on chat actions.
- [x] **1.4. Build floating chat & quick chips** in [ChatBot.tsx](file:///home/geto/Proyectos/PESOS/src/components/ChatBot.tsx): Add floating widget toggle, suggest chips prepopulating chat input, and custom confirmation cards.

## Phase 2: Weather & Gamified Dashboard
- [x] **2.1. Implement weather canvas particles** in [Dashboard.tsx](file:///home/geto/Proyectos/PESOS/src/components/Dashboard.tsx): Add a canvas element and render particle paths for `sunny` (drifts), `cloudy` (mist), and `stormy` (rain lines, lightning flashes), with frame-rate monitoring.
- [x] **2.2. Add close day details & level celebration** in [Dashboard.tsx](file:///home/geto/Proyectos/PESOS/src/components/Dashboard.tsx): Update XP stats breakdown in close-day modal and play sound/confetti on crossing XP level bounds.

## Phase 3: Core Module Enhancements
- [x] **3.1. Add tasks features** in [TaskList.tsx](file:///home/geto/Proyectos/PESOS/src/components/TaskList.tsx): Add category tag selection, a snooze (+24h) action calling SQLite, and trigger canvas-confetti on task completion.
- [x] **3.2. Add habits grid & streaks** in [HabitList.tsx](file:///home/geto/Proyectos/PESOS/src/components/HabitList.tsx): Render a 7-day completion calendar grid (Mon-Sun) and a pulsing habit streak flame count.
- [x] **3.3. Add journal prompts & mood sparkline** in [JournalReflection.tsx](file:///home/geto/Proyectos/PESOS/src/components/JournalReflection.tsx): Create a sidebar prompts drawer and render a mood trend SVG sparkline for the last 10 entries.
- [x] **3.4. Update diet macros & water fill** in [DietLog.tsx](file:///home/geto/Proyectos/PESOS/src/components/DietLog.tsx): Implement color warnings for macro budgets, customizable meal presets, and a animated SVG water cup fill.
- [x] **3.5. Add finance breakdown & MEP tool** in [TransactionSummary.tsx](file:///home/geto/Proyectos/PESOS/src/components/TransactionSummary.tsx): Create a category field dropdown, an SVG monthly category pie chart, and an ARS-to-USD MEP rate conversion calculator.

## Phase 4: Integration & Testing
- [x] **4.1. Run automated checks**: Compile components and run tests via `npm run test` or direct checks.
- [x] **4.2. Verify manual scenarios**: Test AI action triggers, weather performance constraints, confetti on complete, and page integrations.
