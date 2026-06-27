import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Δ2: HMAC-based session cookie. The secret lives in
// ~/.config/pesos/.auth-secret (0o600). The cookie value is the HMAC of a
// fixed label `pesos-session-v1` under the secret. Verification is constant-
// time via crypto.timingSafeEqual.

const SECRET_PATH = path.join(os.homedir(), '.config', 'pesos', '.auth-secret')
const SESSION_LABEL = 'pesos-session-v1'

export function getOrCreateSecret(): string {
  try {
    if (fs.existsSync(SECRET_PATH)) {
      return fs.readFileSync(SECRET_PATH, 'utf8').trim()
    }
  } catch {
    // Fall through to (re)generate.
  }
  const s = crypto.randomBytes(32).toString('hex')
  try {
    fs.mkdirSync(path.dirname(SECRET_PATH), { recursive: true })
    fs.writeFileSync(SECRET_PATH, s, { mode: 0o600 })
  } catch {
    // The key still works in memory for this process; the next launch will retry.
  }
  return s
}

export function signSession(): string {
  return crypto
    .createHmac('sha256', getOrCreateSecret())
    .update(SESSION_LABEL)
    .digest('hex')
}

export function verifySession(cookie: string): boolean {
  try {
    const expected = Buffer.from(signSession())
    const actual = Buffer.from(cookie)
    if (expected.length !== actual.length) return false
    return crypto.timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}
