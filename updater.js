const https = require('https')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

const REPO = 'getodevel-source/PESOS'

// Simple semver comparison: returns true if latest > current
function isOutdated(current, latest) {
  const c = current.replace(/^v/, '').split('.').map(Number)
  const l = latest.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (l[i] > (c[i] || 0)) return true
    if (l[i] < (c[i] || 0)) return false
  }
  return false
}

// Fetch latest release info from GitHub API
function checkUpdate(currentVersion) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO}/releases/latest`,
      headers: { 'User-Agent': 'PESOS-Updater' }
    }

    https.get(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`GitHub API returned status ${res.statusCode}`))
        return
      }

      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const release = JSON.parse(data)
          const latestVersion = release.tag_name
          const updateAvailable = isOutdated(currentVersion, latestVersion)

          // Find the asset link based on platform
          let assetUrl = ''
          let filename = ''
          const platform = process.platform

          if (platform === 'linux') {
            const asset = release.assets.find(a => a.name.endsWith('.AppImage'))
            if (asset) {
              assetUrl = asset.browser_download_url
              filename = asset.name
            }
          } else if (platform === 'win32') {
            const asset = release.assets.find(a => a.name.endsWith('.exe'))
            if (asset) {
              assetUrl = asset.browser_download_url
              filename = asset.name
            }
          } else if (platform === 'darwin') {
            const asset = release.assets.find(a => a.name.endsWith('.zip'))
            if (asset) {
              assetUrl = asset.browser_download_url
              filename = asset.name
            }
          }

          resolve({
            updateAvailable,
            latestVersion,
            assetUrl,
            filename,
            body: release.body
          })
        } catch (err) {
          reject(err)
        }
      })
    }).on('error', reject)
  })
}

// Download file helper with progress callbacks
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    
    const request = (targetUrl) => {
      https.get(targetUrl, { headers: { 'User-Agent': 'PESOS-Updater' } }, (res) => {
        // Handle redirect
        if (res.statusCode === 302 || res.statusCode === 301) {
          request(res.headers.location)
          return
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: status ${res.statusCode}`))
          return
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
        let downloadedBytes = 0

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length
          file.write(chunk)
          if (totalBytes > 0 && onProgress) {
            onProgress(Math.round((downloadedBytes / totalBytes) * 100))
          }
        })

        res.on('end', () => {
          file.end()
          resolve()
        })
      }).on('error', (err) => {
        file.end()
        fs.unlink(destPath, () => reject(err))
      })
    }

    request(url)
  })
}

// Apply update based on platform
function applyUpdate(filePath) {
  const { app } = require('electron')
  const platform = process.platform

  if (platform === 'linux' && process.env.APPIMAGE) {
    const targetPath = process.env.APPIMAGE
    
    // In Linux, we can replace the running AppImage binary directly (hot replacement)
    try {
      fs.copyFileSync(filePath, targetPath)
      fs.chmodSync(targetPath, '755')
      
      // Clean up temp file
      fs.unlinkSync(filePath)
      
      // Restart the AppImage
      app.relaunch({ execPath: targetPath })
      app.exit(0)
    } catch (err) {
      throw new Error(`Failed to apply AppImage update: ${err.message}`)
    }
  } else if (platform === 'win32') {
    // Windows: launch installer executable and quit
    try {
      const child = spawn(filePath, ['/S'], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()
      app.exit(0)
    } catch (err) {
      throw new Error(`Failed to launch Windows installer: ${err.message}`)
    }
  } else {
    // General fallback: just open downloaded file
    const { shell } = require('electron')
    shell.openPath(filePath)
  }
}

module.exports = {
  checkUpdate,
  downloadFile,
  applyUpdate
}
