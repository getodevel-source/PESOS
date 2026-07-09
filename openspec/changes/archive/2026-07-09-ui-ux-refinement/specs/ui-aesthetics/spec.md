# Delta Specification: UI Aesthetics Overhaul (`ui-aesthetics`)

This delta spec modifies the core `ui-aesthetics` specification to incorporate animated weather overlays, visual confetti bursts, and progress animations.

## ADDED Requirements

### Requirement 1.5 Animated Weather Indicators
- **REQ-006**: The dashboard MUST overlay dynamic visual animations matching the calculated weather status:
  - `stormy`: Canvas-based falling rain particle effect.
  - `cloudy`: CSS/SVG drifting cloud overlays.
  - `sunny`: Radiant glowing sun rays animation.
- **REQ-007**: Animations MUST run on hardware-accelerated layers (`will-change: transform` or HTML5 canvas) and MUST be automatically disabled if the Electron frame rate falls below 45 FPS to preserve system performance.

### Requirement 1.6 Visual Celebrations (Confetti and Water Cup)
- **REQ-008**: The application MUST trigger a temporary confetti burst using a CSS/canvas particle generator when:
  - A user checks a task to the `done` status.
  - A user unlocks an RPG level-up event on the dashboard.
- **REQ-009**: The Diet Log page MUST render an SVG water cup icon that dynamically fills with blue color proportional to the percentage of the user's daily water intake goal logged.

## ADDED Scenarios

### Scenario: Stormy weather canvas animation renders
- GIVEN the dashboard weather condition is calculated as `stormy`
- WHEN the dashboard is rendered
- THEN the canvas-based rain animation overlay MUST start rendering falling rain particles.

### Scenario: Confetti burst on task completion
- GIVEN a task list containing pending tasks
- WHEN the user clicks the checkbox to complete a task
- THEN the task item component MUST trigger a visual confetti particle burst at the coordinate of the checkmark.

### Scenario: Water cup animation updates
- GIVEN a water cup visual element with a daily target of 2000ml and current consumption of 500ml (25%)
- WHEN the user logs 500ml more water (totaling 1000ml / 50%)
- THEN the SVG water cup fill height MUST animate smoothly to 50% capacity.
