import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Settings, HistoryItem, LogEntry, SessionStats } from '../types'
import {
  getSettings,
  saveSettings,
  getHistory,
  addHistoryItem,
  deleteHistoryItem,
  clearAllHistory,
  getLogs,
  saveLogs,
  MAX_LOGS,
} from '../utils/storage'
import { dbDeleteImages, dbClearAll } from '../utils/db'

interface AppContextType {
  settings: Settings
  updateSettings: (s: Settings) => void
  history: HistoryItem[]
  addHistory: (item: HistoryItem, images: string[]) => Promise<void>
  removeHistory: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  reloadHistory: () => void
  logs: LogEntry[]
  addLog: (level: LogEntry['level'], message: string, detail?: string) => void
  clearLogs: () => void
  reloadLogs: () => void
  sessionStats: SessionStats
  recordUsage: (images: number, inputTokens?: number, outputTokens?: number) => void
}

const AppContext = createContext<AppContextType>({} as AppContextType)

export const useAppContext = () => useContext(AppContext)

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(getSettings)
  const [history, setHistory] = useState<HistoryItem[]>(getHistory)
  const [logs, setLogs] = useState<LogEntry[]>(getLogs)
  const [sessionStats, setSessionStats] = useState<SessionStats>({ imagesGenerated: 0, inputTokens: 0, outputTokens: 0 })

  const updateSettings = useCallback((s: Settings) => {
    saveSettings(s)
    setSettings(s)
  }, [])

  const addHistory = useCallback(async (item: HistoryItem, images: string[]) => {
    const { dbSaveImages } = await import('../utils/db')
    await dbSaveImages(item.id, images)
    addHistoryItem(item)
    setHistory(getHistory())
  }, [])

  const removeHistory = useCallback(async (id: string) => {
    await dbDeleteImages(id)
    deleteHistoryItem(id)
    setHistory((prev) => prev.filter((h) => h.id !== id))
  }, [])

  const clearHistory = useCallback(async () => {
    await dbClearAll()
    clearAllHistory()
    setHistory([])
  }, [])

  const reloadHistory = useCallback(() => {
    setHistory(getHistory())
  }, [])

  const addLog = useCallback((level: LogEntry['level'], message: string, detail?: string) => {
    setLogs((prev) => {
      const next = [
        { id: `${Date.now()}-${Math.random()}`, time: Date.now(), level, message, detail },
        ...prev,
      ].slice(0, MAX_LOGS)
      saveLogs(next)
      return next
    })
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
    saveLogs([])
  }, [])

  const reloadLogs = useCallback(() => {
    setLogs(getLogs())
  }, [])

  const recordUsage = useCallback((images: number, inputTokens = 0, outputTokens = 0) => {
    setSessionStats((prev) => ({
      imagesGenerated: prev.imagesGenerated + images,
      inputTokens: prev.inputTokens + inputTokens,
      outputTokens: prev.outputTokens + outputTokens,
    }))
  }, [])

  return (
    <AppContext.Provider
      value={{
        settings,
        updateSettings,
        history,
        addHistory,
        removeHistory,
        clearHistory,
        reloadHistory,
        logs,
        addLog,
        clearLogs,
        reloadLogs,
        sessionStats,
        recordUsage,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
