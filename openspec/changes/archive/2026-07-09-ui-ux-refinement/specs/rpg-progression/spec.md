# Delta Specification: RPG Progression (`rpg-progression`)

This delta spec modifies the core `rpg-progression` specification to support visual gamification elements: the 7-day habits completion grid, streak indicators, and the close-day modal summary.

## ADDED Requirements

### Requirement 6 — Habit Consistency Visuals (Streaks and Weekly Grid)
- The HabitList component MUST render the current streak next to each active habit (e.g., "🔥 7 días") retrieved from `user_stats` or computed from consecutive `habit_logs` days.
- The HabitList component MUST render a mini 7-day completion grid (Monday through Sunday) showing checkmarks or filled dots for each day in the current week that a habit was successfully logged.

### Requirement 7 — XP Close-Day Summary
- The "Close Day" modal on the dashboard MUST display a visual summary of the current day's performance before finalizing the day, including:
  - The daily task completion rate (completed tasks vs. total tasks).
  - The count of active habits successfully achieved today.
  - A breakdown of all XP earned today grouped by source (tasks, journal, habits, achievements).

### Requirement 8 — Level-Up Celebration
- The dashboard MUST trigger a level-up event when the user's XP crosses a level boundary.
- The level-up event MUST play a celebration audio sound effect and trigger a fullscreen confetti burst.

## ADDED Scenarios

### Scenario: Habit streak and weekly grid display
- GIVEN a habit with a 5-day streak and completions on Monday, Wednesday, and Friday of the current week
- WHEN the HabitList renders
- THEN the habit entry MUST display "🔥 5 días" and the 7-day grid MUST show active indicators for Mon, Wed, and Fri, and inactive indicators for other days.

### Scenario: Close-Day Modal renders summary
- GIVEN a user has completed 2 tasks (+20 XP), logged 1 habit (+15 XP), and written 1 journal entry (+20 XP) today
- WHEN the user clicks "Close Day"
- THEN the Close-Day modal MUST render a summary showing "3/4 Tareas (+20 XP)", "1 Hábito (+15 XP)", "1 Reflexión (+20 XP)", and total "+55 XP".
