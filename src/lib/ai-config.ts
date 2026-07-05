import fs from 'fs'
import path from 'path'
import os from 'os'

// Δ3: explicit user-chosen default provider, persisted in
// ~/.config/pesos/.ai-config.json. The function MUST default to
// { provider: 'gemini' } when the file is missing or unparseable, and
// MUST NOT throw.

export type AIProvider = 'gemini' | 'opencode'

export interface AIConfig {
  provider: AIProvider
  googleApiKey?: string
  opencodeApiKey?: string
  model?: string
}

const DEFAULT: AIConfig = { provider: 'gemini' }

import { getAppDir } from './paths'

function configPath(): string {
  return path.join(getAppDir(), '.ai-config.json')
}

export function getDefaultProvider(): AIConfig {
  try {
    const p = configPath()
    if (!fs.existsSync(p)) return DEFAULT
    const raw = fs.readFileSync(p, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AIConfig>
    if (parsed.provider !== 'gemini' && parsed.provider !== 'opencode') {
      return DEFAULT
    }
    return {
      provider: parsed.provider,
      googleApiKey: parsed.googleApiKey,
      opencodeApiKey: parsed.opencodeApiKey,
      model: parsed.model,
    }
  } catch {
    return DEFAULT
  }
}
