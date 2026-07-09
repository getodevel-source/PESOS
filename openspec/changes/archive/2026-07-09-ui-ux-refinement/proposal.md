<Proposal: UI/UX Refinement & Chatbot Actions>
## Intent
Improve the overall user experience and task-completion motivation in PESOS by adding gamified/interactive visual polish across all modules and converting the AI chatbot from a read-only advisor to an active helper using Client-Side Intercepted Tags.

## Scope
### In Scope
- **ChatBot**: Enable task, transaction, diet, and habit mutations via XML/JSON action tags; render styled action confirmation cards, floating quick-chat widget, and quick suggestion chips.
- **Dashboard**: Weather animation overlays (CSS/canvas), level-up confetti/sound, and XP summary in the "Close Day" modal.
- **TaskList**: Category priority tags, one-click snooze (+1 day), and completion confetti bursts.
- **HabitList**: Mini 7-day completion grid and habit streaks indicator.
- **JournalReflection**: Mood trend sparklines and reflective prompts drawer.
- **DietLog**: Macro budget limit warnings, custom quick-add presets, and dynamic water glass fill animation.
- **TransactionSummary**: Expense categorization dropdown, SVG/CSS monthly category pie chart, and MEP calculator conversion popover.

### Out of Scope
- Server-side tool calling via OpenAI/Gemini SDKs.
- DB schema migrations (use existing local client mock APIs).

## Capabilities
### New Capabilities
- Chatbot-initiated database mutations via client-side tag interception.
- Contextual visual feedback (confetti, streaks, weekly grids, mood trends, animated weather).
- MEP currency calculator widget.

### Modified Capabilities
- Refined Dashboard, Chat, TaskList, HabitList, Journal, DietLog, and TransactionSummary modules with rich feedback.

## Approach
- **LLM Action Interception**: Add action instructions and schemas to `/api/ai-chat` system prompt. The model outputs XML tags, e.g., `<run_action>{"type": "create_task", "payload": {...}}</run_action>`.
- **Client Processing**: `ChatBot.tsx` parses tags from the stream, executes mutations using the mock Supabase client, and triggers `onRefresh()` to dynamically refresh the dashboard.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/components/ChatBot.tsx` | Modified | Parse tags, run mutations, add floating widget & cards. |
| `src/app/api/ai-chat/route.ts` | Modified | Update system prompt instructions/schemas. |
| `src/components/Dashboard.tsx` | Modified | Dynamic weather animation, level-up celebrations, dynamic refresh. |
| `src/components/TaskList.tsx` | Modified | Category tags, snooze button, completion confetti. |
| `src/components/HabitList.tsx` | Modified | Weekly completion grid and habit streaks. |
| `src/components/JournalReflection.tsx` | Modified | Reflective prompts drawer, mood trend line. |
| `src/components/DietLog.tsx` | Modified | Macro limits warnings, custom presets, water cup fill. |
| `src/components/TransactionSummary.tsx` | Modified | Expense category field, pie chart, MEP widget. |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Prompt Formatting Drifts (tags ignored) | Low | Strict guidelines in prompt; fallback cleanup regex. |
| Chat context growth | Medium | Limit context items (e.g., last 30 entries) passed to API. |
| UI animation performance | Low | Hardware-accelerated CSS and optimized canvas render. |

## Rollback Plan
Perform a git rollback (`git reset --hard PRE_CHANGE_COMMIT`). Since the local SQLite schema is unaffected, no DB migrations need to be reverted.

## Dependencies
- Operational `/api/sqlite` backend and LLM API keys.

## Success Criteria
- [ ] Intercepted chatbot actions trigger successful SQLite mutations (tasks/expenses/diet/habits) and update the UI immediately via `onRefresh()`.
- [ ] Visual assets (confetti, animations, charts) render smoothly without lagging.
- [ ] `npm test` runs green.
</Proposal: UI/UX Refinement & Chatbot Actions>
