import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('UI Aesthetic Overhaul Component Verification', () => {
  const componentsDir = path.resolve(__dirname);

  it('Dashboard.tsx should contain sidebar tab glows, progress glow pulse on XP, and btn-tactile on updates button', () => {
    const filePath = path.join(componentsDir, 'Dashboard.tsx');
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check tactile buttons in sidebar
    expect(content).toContain('btn-tactile');
    // Check active tab glows
    expect(content).toContain('glow-task');
    expect(content).toContain('glow-habit');
    expect(content).toContain('glow-transaction');
    // Check XP bar glow pulse
    expect(content).toContain('animate-progress-glow-pulse');
  });

  it('TaskList.tsx should contain glass-premium and purple completion glow check animation', () => {
    const filePath = path.join(componentsDir, 'TaskList.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Check premium glass panels
    expect(content).toContain('glass-premium');
    // Check purple checklist animation
    expect(content).toContain('animate-check-glow-purple');
  });

  it('HabitList.tsx should contain glass-premium and green status glow indicators for completed daily habits', () => {
    const filePath = path.join(componentsDir, 'HabitList.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Check premium glass panels
    expect(content).toContain('glass-premium');
    // Check green status glow
    expect(content).toContain('glow-habit');
  });

  it('DietLog.tsx should contain neon gradient tracks and btn-tactile on quick add actions', () => {
    const filePath = path.join(componentsDir, 'DietLog.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Check quick-add buttons use btn-tactile
    expect(content).toContain('btn-tactile');
    // Check progress bars have neon gradient tracks (e.g. from-emerald-400, to-green-500, from-blue-400, or glowing gradients)
    expect(content).toContain('bg-gradient-to-r');
  });

  it('JournalReflection.tsx should contain tactile mood buttons, active colored mood glows, and tactile tag toggles', () => {
    const filePath = path.join(componentsDir, 'JournalReflection.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Check btn-tactile usage
    expect(content).toContain('btn-tactile');
    // Check mood emoji active glow (e.g. ring-color or glow shadow)
    expect(content).toMatch(/ring-|shadow-|glow-/);
  });

  it('TransactionSummary.tsx should contain premium card panels and glowing alert badges', () => {
    const filePath = path.join(componentsDir, 'TransactionSummary.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Check premium cards
    expect(content).toContain('glass-premium');
    // Check glowing warning/critical alert shadow or classes
    expect(content).toMatch(/shadow-|glow-/);
  });

  it('ChatBot.tsx should contain AI avatar breathing animation and glassmorphic speech bubbles', () => {
    const filePath = path.join(componentsDir, 'ChatBot.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Check breathing avatar
    expect(content).toContain('animate-avatar-breathing');
    // Check glassmorphic Speech balloons (e.g. bg-panel/ or bg-slate-900/)
    expect(content).toContain('bg-slate-900/');
  });

  // Triangulation: add a second test block that validates replaced legacy classes (must NOT exist)
  describe('Legacy Classes Cleanup (Triangulation)', () => {
    it('should not contain glass-panel-hover in newly premium components', () => {
      const files = ['TaskList.tsx', 'HabitList.tsx', 'DietLog.tsx', 'JournalReflection.tsx', 'TransactionSummary.tsx', 'ChatBot.tsx'];
      files.forEach((file) => {
        const filePath = path.join(componentsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).not.toContain('glass-panel glass-panel-hover');
      });
    });

    it('should have replaced legacy background classes for summary cards in TransactionSummary', () => {
      const filePath = path.join(componentsDir, 'TransactionSummary.tsx');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).not.toContain('bg-slate-950/40 p-2.5 rounded-lg border border-white/5 text-center flex flex-col justify-between');
    });
  });
});
