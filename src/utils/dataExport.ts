import type { HistoryItem, LogEntry } from '../types'
import { getHistory, addHistoryItem, getSettings, getLogs, saveLogs } from './storage'
import { dbGetAll, dbSaveImages } from './db'

export interface ExportedItem extends HistoryItem {
  images: string[]
}

export interface ExportBundleV2 {
  version: 2
  exportedAt: number
  items: ExportedItem[]
}

export interface ExportBundle {
  version: 3
  exportedAt: number
  items: ExportedItem[]
  logs: LogEntry[]
}

/** Loose shape after JSON.parse for import validation */
interface ParsedBackupFile {
  version?: number
  items?: ExportedItem[]
  logs?: LogEntry[]
}

export const exportLocalData = async (): Promise<void> => {
  const items = getHistory()
  const allImages = await dbGetAll()
  const imageMap = new Map(allImages.map((r) => [r.id, r.images]))

  const exportedItems: ExportedItem[] = items.map((item) => ({
    ...item,
    images: imageMap.get(item.id) ?? [],
  }))

  const bundle: ExportBundle = {
    version: 3,
    exportedAt: Date.now(),
    items: exportedItems,
    logs: getLogs(),
  }

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gpt-image-creator-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const importLocalData = async (
  file: File,
  onProgress?: (current: number, total: number) => void,
): Promise<{ imported: number; skipped: number; logsRestored: boolean }> => {
  const text = await file.text()
  const bundle = JSON.parse(text) as ParsedBackupFile

  const okV2 = bundle.version === 2 && Array.isArray(bundle.items)
  const okV3 = bundle.version === 3 && Array.isArray(bundle.items) && Array.isArray(bundle.logs)
  if (!okV2 && !okV3) {
    throw new Error('不支持的文件格式或版本 / Unsupported file format or version')
  }

  const existing = new Set(getHistory().map((h) => h.id))
  const items = bundle.items ?? []
  const total = items.length
  let imported = 0
  let skipped = 0

  for (let i = 0; i < total; i++) {
    const exportedItem = items[i]
    if (!exportedItem) continue

    onProgress?.(i + 1, total)

    const { images, ...item } = exportedItem

    if (existing.has(item.id)) {
      skipped++
      continue
    }

    if (images.length > 0) {
      await dbSaveImages(item.id, images)
    }
    addHistoryItem(item)
    imported++
  }

  let logsRestored = false
  if (bundle.version === 3 && Array.isArray(bundle.logs)) {
    saveLogs(bundle.logs)
    logsRestored = true
  }

  return { imported, skipped, logsRestored }
}

export const exportSettings = (): void => {
  const settings = getSettings()
  const blob = new Blob(
    [JSON.stringify({ version: 1, settings }, null, 2)],
    { type: 'application/json' },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gpt-image-creator-settings-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
