export interface Settings {
  apiBaseUrl: string
  apiKey: string
  imageModels?: string[]
  textApiMode?: 'same' | 'custom'
  textApiBaseUrl?: string
  textApiKey?: string
  textModels?: string[]
  promptOptimizerModel?: string
  forceStreaming?: boolean
}

export type ImageSize =
  | 'auto'
  | 'custom'
  | '1024x1024'
  | '1536x1024'
  | '1024x1536'
  | '2048x2048'
  | '2048x1152'
  | '3840x2160'
  | '2160x3840'

export type ImageQuality = 'auto' | 'low' | 'medium' | 'high'
export type OutputFormat = 'png' | 'jpeg' | 'webp'
export type ModerationLevel = 'auto' | 'low'

export interface GenerateParams {
  model: string
  prompt: string
  negative_prompt?: string
  n: number
  size: ImageSize
  custom_width?: number
  custom_height?: number
  quality: ImageQuality
  output_format: OutputFormat
  output_compression: number
  moderation: ModerationLevel
}

export interface EditParams {
  model: string
  prompt: string
  negative_prompt?: string
  n: number
  size: ImageSize
  custom_width?: number
  custom_height?: number
  quality: ImageQuality
  output_format: OutputFormat
  output_compression: number
}

export interface TokenUsage {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
}

export interface SessionStats {
  imagesGenerated: number
  inputTokens: number
  outputTokens: number
}

export interface HistoryItem {
  id: string
  type: 'generate' | 'edit'
  prompt: string
  createdAt: number
  model: string
  size: string
  quality: string
  count: number
}

export interface LogEntry {
  id: string
  time: number
  level: 'info' | 'success' | 'error'
  message: string
  detail?: string
}
