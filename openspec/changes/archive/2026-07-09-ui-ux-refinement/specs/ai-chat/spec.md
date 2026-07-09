# Delta Specification: AI Chat Actions (`ai-chat`)

This delta spec modifies the core `ai-chat` specification to support client-side intercepted actions (tasks, transactions, habits, diet entries) and UI enhancements.

## ADDED Requirements

### Requirement 7 — AI Action Tag Insertion
The `/api/ai-chat` route system prompt MUST instruct the model to append a `<run_action>` tag containing a structured JSON payload when the user requests a database mutation. The JSON payload MUST conform to the action schema for the requested operation. The tag MUST be formatted exactly as `<run_action>{...}</run_action>`.

Supported mutation types:
- `create_task`: `{"type": "create_task", "payload": {"title": string, "priority": "alta" | "media" | "baja", "category": string}}`
- `create_transaction`: `{"type": "create_transaction", "payload": {"amount": number, "description": string, "category": string}}`
- `toggle_habit`: `{"type": "toggle_habit", "payload": {"habit_id": string, "date": string}}`
- `log_diet`: `{"type": "log_diet", "payload": {"calories": number, "protein": number, "carbs": number, "fat": number, "meal_type": string}}`

### Requirement 8 — Client-Side Tag Interception and Execution
The React client (`ChatBot.tsx`) MUST parse the incoming text stream to detect `<run_action>` tags. Once a complete tag is parsed:
1. The client MUST extract the JSON payload.
2. The client MUST execute the mutation via the browser-side mock Supabase client.
3. The client MUST trigger `onRefresh()` to update the dashboard.
4. The client MUST strip the `<run_action>...</run_action>` block from the visible text response displayed to the user.

### Requirement 9 — Action Confirmation Cards and Quick Chat
The chat interface:
1. MUST render a styled visual confirmation card in the message history upon successfully executing a `<run_action>` payload.
2. MUST support a floating quick-chat widget in the bottom-right corner of the dashboard, accessible across all page views.
3. MUST render suggestion chips (e.g., "📝 Crear tarea", "💸 Gasto", "🥗 Comida") above the input box to trigger pre-filled prompt templates.

## ADDED Scenarios

### Scenario: Client intercepts a task creation action tag
- GIVEN the AI chatbot streams a response containing `<run_action>{"type": "create_task", "payload": {"title": "Comprar pan", "priority": "alta", "category": "Personal"}}</run_action>`
- WHEN the client parses the complete tag block
- THEN the client MUST call the mock Supabase client to insert the task, trigger `onRefresh()`, render a styled confirmation card in the chat history, and hide the raw XML/JSON tags from the chat message text.

### Scenario: Suggestion chip click prepopulates chat
- GIVEN suggestion chips are rendered above the chatbot input field
- WHEN the user clicks "📝 Crear tarea"
- THEN the input field MUST be prepopulated with "Crear una tarea para: " and focus MUST be set to the text area.
