import type { Settings, HistoryItem, LogEntry } from '../types'

const SETTINGS_KEY = 'gpt_image_settings'
const HISTORY_KEY = 'gpt_image_history'
const LOGS_KEY = 'gpt_image_logs'
const MAX_HISTORY = 100
export const MAX_LOGS = 80

export const getSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>
      return {
        apiBaseUrl: parsed.apiBaseUrl ?? 'https://api.openai.com',
        apiKey: parsed.apiKey ?? '',
        imageModels: parsed.imageModels ?? ['gpt-image-2'],
        textApiMode: parsed.textApiMode ?? 'same',
        textApiBaseUrl: parsed.textApiBaseUrl ?? '',
        textApiKey: parsed.textApiKey ?? '',
        textModels: parsed.textModels ?? ['gpt-4o-mini'],
        promptOptimizerModel: parsed.promptOptimizerModel ?? parsed.textModels?.[0] ?? 'gpt-4o-mini',
        forceStreaming: parsed.forceStreaming ?? false,
      }
    }
  } catch { /* ignore */ }
  return {
    apiBaseUrl: 'https://api.openai.com',
    apiKey: '',
    imageModels: ['gpt-image-2'],
    textApiMode: 'same',
    textApiBaseUrl: '',
    textApiKey: '',
    textModels: ['gpt-4o-mini'],
    promptOptimizerModel: 'gpt-4o-mini',
    forceStreaming: false,
  }
}

export const saveSettings = (settings: Settings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export const getHistory = (): HistoryItem[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) return JSON.parse(raw) as HistoryItem[]
  } catch { /* ignore */ }
  return []
}

export const addHistoryItem = (item: HistoryItem): void => {
  const history = getHistory()
  history.unshift(item)
  if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export const deleteHistoryItem = (id: string): void => {
  const history = getHistory().filter((item) => item.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export const clearAllHistory = (): void => {
  localStorage.removeItem(HISTORY_KEY)
}

export const getLogs = (): LogEntry[] => {
  try {
    const raw = localStorage.getItem(LOGS_KEY)
    if (raw) return JSON.parse(raw) as LogEntry[]
  } catch { /* ignore */ }
  return []
}

export const saveLogs = (logs: LogEntry[]): void => {
  // Strip detail (which may contain large base64 data) before persisting to localStorage
  const stripped = logs.slice(0, MAX_LOGS).map(({ detail: _detail, ...rest }) => rest)
  try {
    localStorage.setItem(LOGS_KEY, JSON.stringify(stripped))
  } catch {
    // Quota exceeded — skip persistence silently
  }
}
