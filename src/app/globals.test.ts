import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Global CSS Overhaul Verification', () => {
  const cssPath = path.resolve(__dirname, 'globals.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  it('should define CSS variables for neon glows and glass fallbacks', () => {
    expect(cssContent).toContain('--color-glow-green');
    expect(cssContent).toContain('--color-glow-blue');
    expect(cssContent).toContain('--color-glow-purple');
    expect(cssContent).toContain('--bg-glass-fallback');
  });

  it('should define the .glass-premium utility class', () => {
    expect(cssContent).toMatch(/\.glass-premium/);
  });

  it('should define the .btn-tactile utility class', () => {
    expect(cssContent).toMatch(/\.btn-tactile/);
  });

  it('should define the keyframe animations: avatar-breathing, progress-glow-pulse, and check-glow', () => {
    expect(cssContent).toContain('avatar-breathing');
    expect(cssContent).toContain('progress-glow-pulse');
    expect(cssContent).toContain('check-glow');
  });

  // Triangulation: add a second test block that validates specific values and mapped animation classes
  describe('CSS Rule Values and Classes (Triangulation)', () => {
    it('should define exact colors and mappings', () => {
      expect(cssContent).toContain('rgba(16, 185, 129, 0.4)');
      expect(cssContent).toContain('rgba(59, 130, 246, 0.4)');
      expect(cssContent).toContain('rgba(124, 58, 237, 0.4)');
      expect(cssContent).toContain('rgb(13, 17, 23)');
    });

    it('should define status glow classes', () => {
      expect(cssContent).toContain('.glow-habit');
      expect(cssContent).toContain('.glow-transaction');
      expect(cssContent).toContain('.glow-task');
    });

    it('should define helper animation classes', () => {
      expect(cssContent).toContain('.animate-avatar-breathing');
      expect(cssContent).toContain('.animate-progress-glow-pulse');
      expect(cssContent).toContain('.animate-check-glow-purple');
    });
  });
});
