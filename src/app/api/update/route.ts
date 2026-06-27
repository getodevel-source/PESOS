import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { checkUpdate, downloadFile } from '../../../../updater'

export const dynamic = 'force-dynamic'

const configDir = path.join(os.homedir(), '.config', 'pesos')
const progressPath = path.join(configDir, 'update-progress.json')
const pendingPath = path.join(configDir, '.update-pending')

// Read package.json version
function getCurrentVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'))
    return pkg.version
  } catch {
    return '0.1.0'
  }
}

export async function GET() {
  try {
    const current = getCurrentVersion()
    const updateInfo = await checkUpdate(current)

    // Check if there's active download progress
    let progress = -1
    if (fs.existsSync(progressPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(progressPath, 'utf8'))
        // If it was written recently (less than 2 minutes ago), use it
        if (Date.now() - data.timestamp < 120000) {
          progress = data.percent
        }
      } catch {}
    }

    return NextResponse.json({
      currentVersion: current,
      ...updateInfo,
      progress
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al verificar actualizaciones'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { assetUrl, filename } = await request.json()

    if (!assetUrl || !filename) {
      return NextResponse.json({ error: 'URL y nombre de archivo requeridos.' }, { status: 400 })
    }

    const tempDest = path.join(os.tmpdir(), filename)

    // Run download in background asynchronously
    // We respond immediately to the client that the download has started
    downloadFile(assetUrl, tempDest, (percent: number) => {
      // Write progress to config dir so client can poll it
      try {
        fs.writeFileSync(progressPath, JSON.stringify({ percent, timestamp: Date.now() }), 'utf8')
      } catch {}
    }).then(() => {
      // Completed! Write pending file to trigger Electron restart
      try {
        fs.writeFileSync(pendingPath, tempDest, 'utf8')
        // Reset progress file
        fs.writeFileSync(progressPath, JSON.stringify({ percent: 100, timestamp: Date.now() }), 'utf8')
      } catch {}
    }).catch((err) => {
      console.error('Download background task failed:', err)
      try {
        fs.writeFileSync(progressPath, JSON.stringify({ percent: -1, error: err.message, timestamp: Date.now() }), 'utf8')
      } catch {}
    })

    return NextResponse.json({ success: true, message: 'Descarga iniciada en segundo plano.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al descargar actualización'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
