# Exploration: UI/UX Refinement and Chatbot Actions

### Current State
PESOS is a local personal dashboard that integrates task tracking, habit tracking, journaling, diet logging, and financial summaries. 
- It uses a custom client-side mock (`supabase-client.ts`) that forwards requests to `/api/sqlite` to persist data in a local better-sqlite3 database.
- The Chatbot component (`ChatBot.tsx` calling `/api/ai-chat/route.ts`) is currently **read-only**. It reads user context (today's tasks, habits, transactions, monthly budget) and injects it into the system prompt of Gemini or OpenCode (DeepSeek/MiniMax/Qwen). The chatbot generates a plain text response without mutating the database.
- The UI is designed with a premium glassmorphic dark theme, using custom glows. A dynamic "weather" condition (sunny, cloudy, stormy) is calculated on the dashboard based on overdue tasks and budget status, changing the background gradient, but lacks motion or animated representation.

### Affected Areas
- `src/components/ChatBot.tsx` — Needs to accept `onRefresh?: () => void`, parse stream outputs for action payloads, execute client-side database mutations (insert task, add transaction, log meals, log water, toggle habits), and render visual action confirmation cards and quick-input chips.
- `src/app/api/ai-chat/route.ts` — Needs to include action schemas and instructions in the system prompt to guide the LLM to output actions when requested by the user.
- `src/components/Dashboard.tsx` — Needs to pass `onRefresh={handleRefresh}` to the `<ChatBot />` component, and implement weather animation particle/canvas effects (e.g. falling rain, sun rays).

### Approaches

1. **Client-Side Intercepted XML/JSON Action Tags (Recommended)**
   - *Description*: Instruct the LLM in the system prompt to append an XML/JSON tag block (e.g. `<run_action>{"type": "create_task", "payload": {...}}</run_action>`) whenever the user asks it to perform an action. The React client (`ChatBot.tsx`) parses the completed text stream, strips the tag from the final user response, executes the mutation via the browser-side mock Supabase client, displays a styled confirmation card in the chat history, and triggers `onRefresh()` to dynamically update the entire dashboard.
   - *Pros*:
     - Bypasses SDK-specific tool calling differences between Gemini and OpenAI/OpenCode APIs.
     - Extremely clean and easy to maintain (under 150 lines of code).
     - Database modifications run securely inside the user's browser-client context.
     - Enables immediate, synchronous UI updates via `onRefresh()`.
   - *Cons*: Relies on prompt engineering and the model following JSON output formatting rules (highly robust on Gemini 1.5/2.5/3.5 and DeepSeek V4).
   - *Effort*: Medium.

2. **Native SDK Tool Calling (Server-Side)**
   - *Description*: Formally define tool schemas (`create_task`, `create_transaction`, `log_diet`, `toggle_habit`) in `/api/ai-chat/route.ts` using Google Generative AI functions and OpenAI function calling structures. When the API detects a tool call, it executes it on the server using the Admin client, rebuilds the prompt context, and returns the final answer.
   - *Pros*: Built-in LLM support, no regex parsing needed.
   - *Cons*:
     - High maintenance: Must define and translate schemas for both Gemini and OpenCode SDKs.
     - The browser client has no standard way of knowing a DB mutation occurred unless we build a server-to-client notification channel or force-refresh the dashboard after every message.
   - *Effort*: High.

---

### UI/UX & Functional Improvements by Module

#### 1. ChatBot / Pesito
- **Actions Execution**: Enable task creation, transaction logging, diet logging, and habit checking via chat.
- **Action Confirmation Cards**: Render a styled custom component representing the created task/expense directly in the chat history.
- **Floating Quick-Chat Widget**: A floating chat bubble in the bottom-right corner that allows quick interactions from any page view without switching tabs.
- **Quick Suggestion Chips**: Suggestion buttons above the input field (e.g., "📝 Crear tarea", "💸 Gasto", "🥗 Comida") to lower interaction friction.

#### 2. Dashboard
- **Animated Weather Indicators**: Add HTML5 canvas or simple CSS animated particle overlays (falling rain for "stormy", drift clouds for "cloudy", radiant glow rays for "sunny") to bring the dashboard weather to life.
- **RPG Level Card**: Add level-up celebrations (e.g., sound/confetti) when user crosses XP boundaries.
- **Summary Visuals**: Beautify the "Close Day" modal with charts showing daily task completion rate, habits achieved, and a breakdown of XP earned today.

#### 3. TaskList
- **Category Tags**: Add colored priority indicators or group tasks into "Trabajo", "Personal", "Estudio".
- **Snooze Action**: Add a one-click "snooze to tomorrow" button (+1 day to due date).
- **Completion Confetti**: Fire a small CSS particle burst when a task checkmark is toggled to "done".

#### 4. HabitList
- **Habit Streaks**: Render the current streak next to each habit (e.g., "🔥 7 días").
- **Weekly Tracking Grid**: Render a mini 7-day completion grid (Mon-Sun) to track weekly consistency.

#### 5. JournalReflection
- **Reflective Prompts**: Add a "Prompts" drawer suggesting journaling ideas to fight writer's block.
- **Mood History Sparkline**: Draw a small trendline in the reflection page showing mood variance over the past 30 days.

#### 6. DietLog
- **Macro Budgets & Warnings**: Color-code macro limits and warn the user when exceeding calorie budgets.
- **Custom Presets**: Allow users to save their own foods to the preset quick-add list.
- **Water Cup animation**: Fill a visual glass icon dynamically as the user logs water.

#### 7. TransactionSummary
- **Expense Categorization**: Categorize transactions (e.g., "Comida", "Transporte", "Suscripciones").
- **Category Pie Chart**: A clean SVG/CSS breakdown chart of monthly spend by category.
- **MEP Calculator Widget**: A quick popover to calculate USD-to-ARS conversions at current rates.

---

### Recommendation
Adopt **Approach 1 (Client-Side Intercepted Tags)** for chatbot actions due to its ease of implementation, uniform behavior across AI providers, and immediate dashboard synchronization. Combine this with the UI/UX changes outlined above to dramatically enhance the application's feedback loops and gamification mechanics.

### Risks
- **Prompt Formatting Drifts**: If the model ignores the `<run_action>` tags, the action will not run and the raw JSON might be printed. This can be mitigated by strict system prompt guidelines and fallback text cleanup.
- **Context Size**: As the user logs more tasks and transactions, the context fed to `/api/ai-chat` will grow. Keeping limits (e.g., limit 30 for tasks/transactions) is critical.

### Ready for Proposal
**Yes**. The proposal is solid and ready to be presented to the user. We will implement chatbot actions, animated weather, expense categorization, habits grids, and visual cards.
