import { app, ipcMain, net } from 'electron'

const RELEASES_URL = 'https://api.github.com/repos/oscarweb/typona/releases/latest'

function isNewer(latestVersion, currentVersion) {
  const toParts = (version) => version.split('.').map((part) => Number(part) || 0)
  const [latestMajor, latestMinor, latestPatch] = toParts(latestVersion)
  const [currentMajor, currentMinor, currentPatch] = toParts(currentVersion)
  if (latestMajor !== currentMajor) return latestMajor > currentMajor
  if (latestMinor !== currentMinor) return latestMinor > currentMinor
  return latestPatch > currentPatch
}

export function registerUpdateHandlers() {
  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) return { hasUpdate: false }

    try {
      const response = await net.fetch(RELEASES_URL, {
        headers: { 'User-Agent': 'Typona-App', Accept: 'application/vnd.github+json' }
      })
      if (!response.ok) return { hasUpdate: false }

      const data = await response.json()
      const latestVersion = String(data.tag_name || '').replace(/^v/, '')
      if (!latestVersion) return { hasUpdate: false }

      const hasUpdate = isNewer(latestVersion, app.getVersion())
      return { hasUpdate, latestVersion, url: data.html_url }
    } catch {
      return { hasUpdate: false }
    }
  })
}
