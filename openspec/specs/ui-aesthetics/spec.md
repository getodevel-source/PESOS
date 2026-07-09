# Specification: UI Aesthetics Overhaul (ui-aesthetics)

## 1. Requirements

### 1.1 Dark Glassmorphic Design
- **REQ-001**: The user interface MUST render a dark glassmorphic appearance using custom CSS theme variables (e.g., `--bg-glass-color`, `--glass-blur-radius`, and `--glass-border-color`).
- **REQ-002**: A safety limit for Electron backdrop-filter blur MUST be enforced. If the platform does not support hardware acceleration or background blending (or if frame rate drops below 45 FPS), the application SHALL disable the backdrop blur filter and fallback to a semi-opaque solid color (`--bg-glass-fallback`).

### 1.2 Tactile Interactions
- **REQ-003**: All interactive elements (e.g., buttons, clickable list items, and form inputs) MUST respond with a tactile visual offset on active click (`:active` state), physically shifting downwards by 1px to 2px or reducing depth.

### 1.3 Contextual Status Glows
- **REQ-004**: Active status indicators and highlighted elements MUST use glowing shadow effects via `box-shadow` values to reflect status colors:
  - Green glow (`--glow-habit`) for habit-related elements.
  - Blue glow (`--glow-transaction`) for transaction-related elements.
  - Purple glow (`--glow-task`) for task-related elements.

### 1.4 Accessibility & Contrast
- **REQ-005**: All text elements MUST meet WCAG 2.1 AA contrast targets (minimum 4.5:1 contrast ratio for normal text, 3:1 for large text) when displayed on top of the semi-transparent glassmorphic background layer.

### 1.5 Animated Weather Indicators
- **REQ-006**: The dashboard MUST overlay dynamic visual animations matching the calculated weather status:
  - `stormy`: Canvas-based falling rain particle effect.
  - `cloudy`: CSS/SVG drifting cloud overlays.
  - `sunny`: Radiant glowing sun rays animation.
- **REQ-007**: Animations MUST run on hardware-accelerated layers (`will-change: transform` or HTML5 canvas) and MUST be automatically disabled if the Electron frame rate falls below 45 FPS to preserve system performance.

### 1.6 Visual Celebrations (Confetti and Water Cup)
- **REQ-008**: The application MUST trigger a temporary confetti burst using a CSS/canvas particle generator when:
  - A user checks a task to the `done` status.
  - A user unlocks an RPG level-up event on the dashboard.
- **REQ-009**: The Diet Log page MUST render an SVG water cup icon that dynamically fills with blue color proportional to the percentage of the user's daily water intake goal logged.

---

## 2. Scenarios

### Scenario 1: Rendering the Dark Glassmorphic UI with Hardware Acceleration
* **GIVEN** the application is running on a platform with hardware acceleration enabled
* **WHEN** the main dashboard view is rendered
* **THEN** the UI MUST display a semi-transparent background with the specified backdrop-filter blur using custom theme variables

### Scenario 2: Backdrop Blur Fallback (Electron Safety Limit)
* **GIVEN** the application is running in an environment where frame rate drops below 45 FPS or backdrop blending is unsupported
* **WHEN** the UI renders a glassmorphic element
* **THEN** the application SHALL disable the backdrop-filter and display the solid fallback background (`--bg-glass-fallback`) to preserve rendering performance

### Scenario 3: Tactile Visual Offset on Active Click
* **GIVEN** a button or list item is rendered in the active state
* **WHEN** a user clicks and holds the interactive element
* **THEN** the element MUST transform with a 1px vertical translation offset (`translateY(1px)`) to provide immediate tactile feedback

### Scenario 4: Contextual Status Glow Display
* **GIVEN** a list of items consisting of habits, transactions, and tasks
* **WHEN** these items display their active status glow indicators
* **THEN** the habit item MUST show a green box-shadow glow, the transaction item MUST show a blue box-shadow glow, and the task item MUST show a purple box-shadow glow

### Scenario 5: Text Contrast Conformance
* **GIVEN** text labels are overlaid on the semi-transparent glass background
* **WHEN** the background transparency or theme dynamic color changes
* **THEN** the text foreground color MUST adjust to maintain a contrast ratio of at least 4.5:1 against the underlying glass layer

### Scenario 6: Stormy weather canvas animation renders
* **GIVEN** the dashboard weather condition is calculated as `stormy`
* **WHEN** the dashboard is rendered
* **THEN** the canvas-based rain animation overlay MUST start rendering falling rain particles.

### Scenario 7: Confetti burst on task completion
* **GIVEN** a task list containing pending tasks
* **WHEN** the user clicks the checkbox to complete a task
* **THEN** the task item component MUST trigger a visual confetti particle burst at the coordinate of the checkmark.

### Scenario 8: Water cup animation updates
* **GIVEN** a water cup visual element with a daily target of 2000ml and current consumption of 500ml (25%)
* **WHEN** the user logs 500ml more water (totaling 1000ml / 50%)
* **THEN** the SVG water cup fill height MUST animate smoothly to 50% capacity.
