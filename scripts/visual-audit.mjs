/**
 * Visual audit script for PESOS app
 * Captures screenshots of each module/tab and saves them for inspection
 */
import puppeteer from 'puppeteer'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE_URL = 'http://localhost:3000'
const SCREENSHOTS_DIR = join(__dirname, '../.screenshots')

if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true })

const TABS = [
  { name: 'overview',  label: 'Dashboard Overview' },
  { name: 'tasks',     label: 'Tareas' },
  { name: 'habits',    label: 'Hábitos' },
  { name: 'journal',   label: 'Diario' },
  { name: 'diet',      label: 'Dieta' },
  { name: 'finances',  label: 'Finanzas' },
  { name: 'ai',        label: 'Pesito AI' },
]

async function waitForSelector(page, selector, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { timeout })
    return true
  } catch {
    return false
  }
}

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  })

  const page = await browser.newPage()
  
  // Capture console errors
  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push({ tab: 'N/A', msg: msg.text() })
  })
  page.on('pageerror', err => consoleErrors.push({ tab: 'N/A', msg: err.message }))

  console.log('Navigating to app...')
  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 })

  // Wait for app to load (skip auth gate if already logged in)
  const isLoginPage = await waitForSelector(page, '[data-testid="auth-gate"], input[type="email"]', 3000)
  
  if (isLoginPage) {
    console.log('Auth gate detected. App requires login - taking screenshot of auth gate.')
    await page.screenshot({ path: join(SCREENSHOTS_DIR, 'auth-gate.png'), fullPage: true })
    console.log('AUTH_GATE_DETECTED')
    await browser.close()
    return
  }

  // Take initial screenshot
  await page.screenshot({ path: join(SCREENSHOTS_DIR, '00-initial.png'), fullPage: true })
  console.log('Initial screenshot taken')

  // Navigate through each tab
  for (const tab of TABS) {
    console.log(`\n📸 Capturing tab: ${tab.label}`)
    
    // Find and click the tab button
    const tabClicked = await page.evaluate((tabName) => {
      // Look for sidebar buttons by data-tab attribute or text content
      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
      const tabBtn = buttons.find(btn => {
        const text = btn.textContent?.toLowerCase() || ''
        const dataTab = btn.getAttribute('data-tab') || ''
        return dataTab === tabName || 
               (tabName === 'overview' && (text.includes('overview') || text.includes('resumen') || text.includes('inicio'))) ||
               (tabName === 'tasks' && (text.includes('tarea') || text.includes('task'))) ||
               (tabName === 'habits' && (text.includes('hábito') || text.includes('habit'))) ||
               (tabName === 'journal' && (text.includes('diario') || text.includes('journal') || text.includes('reflec'))) ||
               (tabName === 'diet' && (text.includes('diet') || text.includes('comid') || text.includes('aliment'))) ||
               (tabName === 'finances' && (text.includes('financ') || text.includes('gasto') || text.includes('transac'))) ||
               (tabName === 'ai' && (text.includes('pesito') || text.includes('chat') || text.includes('ai') || text.includes('bot')))
      })
      if (tabBtn) {
        tabBtn.click()
        return true
      }
      return false
    }, tab.name)

    if (!tabClicked) {
      console.log(`  ⚠️  Could not find tab button for: ${tab.name}`)
    }

    // Wait for content to load
    await new Promise(r => setTimeout(r, 1000))

    // Take screenshot
    await page.screenshot({ 
      path: join(SCREENSHOTS_DIR, `${tab.name}.png`), 
      fullPage: true 
    })
    console.log(`  ✓ Screenshot saved: ${tab.name}.png`)

    // Check for visible error messages in DOM
    const domErrors = await page.evaluate(() => {
      const errorElements = Array.from(document.querySelectorAll(
        '[class*="error"], [class*="Error"], [role="alert"], .text-red-400, .text-red-500, .bg-red-'
      ))
      return errorElements
        .filter(el => el.textContent && el.textContent.trim().length > 0)
        .map(el => el.textContent?.trim().substring(0, 100))
        .filter(Boolean)
    })
    
    if (domErrors.length > 0) {
      console.log(`  ❌ DOM errors found:`)
      domErrors.forEach(e => console.log(`     - ${e}`))
    }

    // Check for layout overflow
    const overflows = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('*'))
      return els
        .filter(el => {
          const rect = el.getBoundingClientRect()
          return rect.right > window.innerWidth + 5 || rect.bottom > window.innerHeight * 2
        })
        .slice(0, 5)
        .map(el => `${el.tagName}.${el.className.substring(0, 50)}`)
    })

    if (overflows.length > 0) {
      console.log(`  ⚠️  Overflow elements:`)
      overflows.forEach(e => console.log(`     - ${e}`))
    }
  }

  // Collect final console errors
  if (consoleErrors.length > 0) {
    console.log('\n\n🚨 Console Errors:')
    consoleErrors.forEach(e => console.log(`  - [${e.tab}] ${e.msg}`))
  }

  console.log(`\n\n✅ Screenshots saved to: ${SCREENSHOTS_DIR}`)
  await browser.close()
}

run().catch(err => {
  console.error('Script error:', err)
  process.exit(1)
})
