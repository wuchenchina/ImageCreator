import type { Settings } from '../types'

/** Single-line prefix so pasted strings are recognizable */
const PREFIX = 'gic-settings:v1:'

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function encodeSettingsShare(settings: Settings): string {
  const payload = JSON.stringify({
    v: 1 as const,
    apiBaseUrl: settings.apiBaseUrl,
    apiKey: settings.apiKey,
    imageModels: settings.imageModels,
    textApiMode: settings.textApiMode,
    textApiBaseUrl: settings.textApiBaseUrl,
    textApiKey: settings.textApiKey,
    textModels: settings.textModels,
    promptOptimizerModel: settings.promptOptimizerModel,
  })
  return PREFIX + utf8ToBase64(payload)
}

export function decodeSettingsShare(text: string): Settings {
  const t = text.trim()
  const body = t.startsWith(PREFIX) ? t.slice(PREFIX.length) : t
  if (!body) {
    throw new Error('空字符串 / Empty payload')
  }
  const json = base64ToUtf8(body)
  const o = JSON.parse(json) as {
    v?: number
    apiBaseUrl?: unknown
    apiKey?: unknown
    imageModels?: unknown
    textApiMode?: unknown
    textApiBaseUrl?: unknown
    textApiKey?: unknown
    textModels?: unknown
    promptOptimizerModel?: unknown
  }
  if (
    o.v !== 1 ||
    typeof o.apiBaseUrl !== 'string' ||
    typeof o.apiKey !== 'string'
  ) {
    throw new Error('无效的配置字符串 / Invalid settings payload')
  }
  return {
    apiBaseUrl: o.apiBaseUrl,
    apiKey: o.apiKey,
    imageModels: Array.isArray(o.imageModels)
      ? o.imageModels.filter((model): model is string => typeof model === 'string')
      : ['gpt-image-2'],
    textApiMode: o.textApiMode === 'custom' ? 'custom' : 'same',
    textApiBaseUrl: typeof o.textApiBaseUrl === 'string' ? o.textApiBaseUrl : '',
    textApiKey: typeof o.textApiKey === 'string' ? o.textApiKey : '',
    textModels: Array.isArray(o.textModels)
      ? o.textModels.filter((model): model is string => typeof model === 'string')
      : ['gpt-4o-mini'],
    promptOptimizerModel: typeof o.promptOptimizerModel === 'string' ? o.promptOptimizerModel : 'gpt-4o-mini',
  }
}
