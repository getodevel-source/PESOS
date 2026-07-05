import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'os'
import fs from 'fs'
import path from 'path'

// Mocking os module before importing paths
let mockPlatform = 'linux'
let mockHomedir = '/home/user'

vi.mock('os', () => {
  return {
    platform: () => mockPlatform,
    homedir: () => mockHomedir,
    default: {
      platform: () => mockPlatform,
      homedir: () => mockHomedir,
    }
  }
})

// Now import paths
import { getAppDir } from './paths'

describe('paths', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetAllMocks()
    process.env = { ...originalEnv }
    // Clean environment variables that may pollute tests
    delete process.env.XDG_DATA_HOME
    delete process.env.APPDATA
    
    mockPlatform = 'linux'
    mockHomedir = '/home/user'
    
    // Spy on fs methods
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => '')
    vi.spyOn(fs, 'copyFileSync').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  describe('getAppDir', () => {
    it('resolves Linux path correctly with XDG_DATA_HOME', () => {
      mockPlatform = 'linux'
      process.env.XDG_DATA_HOME = '/custom/xdg/data'
      expect(getAppDir()).toBe('/custom/xdg/data/pesos')
    })

    it('resolves Linux path with fallback to ~/.local/share/pesos', () => {
      mockPlatform = 'linux'
      delete process.env.XDG_DATA_HOME
      expect(getAppDir()).toBe('/home/user/.local/share/pesos')
    })

    it('resolves macOS path correctly', () => {
      mockPlatform = 'darwin'
      expect(getAppDir()).toBe('/home/user/Library/Application Support/pesos')
    })

    it('resolves Windows path correctly with APPDATA', () => {
      mockPlatform = 'win32'
      process.env.APPDATA = 'C:\\Users\\user\\AppData\\Roaming'
      expect(getAppDir()).toBe(path.join('C:\\Users\\user\\AppData\\Roaming', 'pesos'))
    })

    it('resolves Windows path with fallback to home directory AppData', () => {
      mockPlatform = 'win32'
      delete process.env.APPDATA
      expect(getAppDir()).toBe(path.join('/home/user', 'AppData', 'Roaming', 'pesos'))
    })

    it('creates directory if it does not exist', () => {
      mockPlatform = 'linux'
      getAppDir()
      expect(fs.mkdirSync).toHaveBeenCalledWith('/home/user/.local/share/pesos', { recursive: true })
    })

    it('migrates legacy config files if legacy db exists and new db does not', () => {
      mockPlatform = 'linux'
      
      // Mock existsSync calls:
      // - check if new dir exists (false)
      // - check if legacy db exists (true)
      // - check if new db exists (false)
      // - check files to migrate (legacy/pesos.db -> true, legacy/.env.local -> true, legacy/.ai-config.json -> false)
      vi.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString()
        if (pathStr === '/home/user/.local/share/pesos') return false
        if (pathStr === '/home/user/.config/pesos/pesos.db') return true
        if (pathStr === '/home/user/.local/share/pesos/pesos.db') return false
        if (pathStr === '/home/user/.config/pesos/.env.local') return true
        if (pathStr === '/home/user/.config/pesos/.ai-config.json') return false
        return false
      })

      getAppDir()

      // Should copy pesos.db and .env.local but not .ai-config.json (since it doesn't exist in legacy)
      expect(fs.copyFileSync).toHaveBeenCalledWith(
        '/home/user/.config/pesos/pesos.db',
        '/home/user/.local/share/pesos/pesos.db'
      )
      expect(fs.copyFileSync).toHaveBeenCalledWith(
        '/home/user/.config/pesos/.env.local',
        '/home/user/.local/share/pesos/.env.local'
      )
      expect(fs.copyFileSync).not.toHaveBeenCalledWith(
        '/home/user/.config/pesos/.ai-config.json',
        expect.any(String)
      )
    })
  })
})
