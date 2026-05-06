import type { Settings, GenerateParams, EditParams, TokenUsage } from '../types'
import { getImageSize } from './imageOptions'

interface ImageResponseData {
  b64_json: string
  revised_prompt?: string
}

interface ImageResponse {
  data: ImageResponseData[]
  usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  }
}

export interface GenerateResult {
  images: string[]
  revisedPrompts: string[]
  usage?: TokenUsage
}

interface ApiError {
  error?: { message?: string }
}

export type DevLogFn = (detail: string) => void

interface ModelsResponse {
  data?: Array<{ id?: string }>
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

interface ChatCompletionStreamChunk {
  choices?: Array<{
    delta?: { content?: string }
    finish_reason?: string | null
  }>
}


export interface QuotaResult {
  source: string
  summary: string
  details: string[]
}

const getBaseUrl = (settings: Settings) => settings.apiBaseUrl.replace(/\/$/, '')
const getTextBaseUrl = (settings: Settings) => (
  settings.textApiMode === 'custom' && settings.textApiBaseUrl
    ? settings.textApiBaseUrl
    : settings.apiBaseUrl
).replace(/\/$/, '')

const getTextApiKey = (settings: Settings) => (
  settings.textApiMode === 'custom' && settings.textApiKey ? settings.textApiKey : settings.apiKey
)

const parseError = async (res: Response): Promise<string> => {
  try {
    const json = (await res.json()) as ApiError
    return json?.error?.message ?? `HTTP ${res.status} ${res.statusText}`
  } catch {
    return `HTTP ${res.status} ${res.statusText}`
  }
}

const logFetchResponse = async (onDevLog: DevLogFn | undefined, res: Response, label = '') => {
  if (!onDevLog) return

  try {
    const json = await res.clone().json()
    onDevLog(`← RESPONSE ${label}${label ? ' ' : ''}${res.status} ${res.statusText}\n\n${JSON.stringify(json, null, 2)}`)
  } catch {
    const text = await res.clone().text().catch(() => '')
    onDevLog(`← RESPONSE ${label}${label ? ' ' : ''}${res.status} ${res.statusText}\n\n${text}`)
  }
}

const chatCompletion = async (
  url: string,
  authHeaders: Record<string, string>,
  body: Record<string, unknown>,
  forceStreaming: boolean,
  onDevLog?: DevLogFn,
): Promise<string> => {
  const headers = { ...authHeaders, 'Content-Type': 'application/json' }

  if (forceStreaming) {
    const streamBody = { ...body, stream: true }
    onDevLog?.(`→ REQUEST\nPOST ${url}\nAuthorization: Bearer [redacted]\nContent-Type: application/json\n\n${JSON.stringify(streamBody, null, 2)}`)

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(streamBody) })

    if (!res.ok) {
      const errText = await parseError(res)
      onDevLog?.(`← RESPONSE ${res.status} ${res.statusText}\n\n${errText}`)
      throw new Error(errText)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body reader available')

    const decoder = new TextDecoder()
    let content = ''
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const chunk = JSON.parse(data) as ChatCompletionStreamChunk
            content += chunk.choices?.[0]?.delta?.content ?? ''
          } catch { /* ignore malformed SSE chunks */ }
        }
      }
    } finally {
      reader.releaseLock()
    }

    onDevLog?.(`← STREAMING RESPONSE 200 OK\n\n${content}`)
    return content.trim()
  }

  onDevLog?.(`→ REQUEST\nPOST ${url}\nAuthorization: Bearer [redacted]\nContent-Type: application/json\n\n${JSON.stringify(body, null, 2)}`)
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  await logFetchResponse(onDevLog, res)
  if (!res.ok) throw new Error(await parseError(res))
  const data = (await res.json()) as ChatCompletionResponse
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

export const generateImages = async (
  settings: Settings,
  params: GenerateParams,
  onDevLog?: DevLogFn,
): Promise<GenerateResult> => {
  const url = `${getBaseUrl(settings)}/v1/images/generations`

  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    negative_prompt: params.negative_prompt || undefined,
    n: params.n,
    size: params.size === 'auto' ? undefined : getImageSize(params),
    quality: params.quality === 'auto' ? undefined : params.quality,
    output_format: params.output_format,
    moderation: params.moderation,
  }

  if (params.output_format !== 'png') {
    body.output_compression = params.output_compression
  }

  Object.keys(body).forEach((k) => {
    if (body[k] === undefined) delete body[k]
  })

  onDevLog?.(`→ REQUEST\nPOST ${url}\n\n${JSON.stringify(body, null, 2)}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await parseError(res)
    onDevLog?.(`← RESPONSE ${res.status} ${res.statusText}\n\n${errText}`)
    throw new Error(errText)
  }

  const data = (await res.json()) as ImageResponse
  onDevLog?.(`← RESPONSE ${res.status} ${res.statusText}\n\n${JSON.stringify(data, null, 2)}`)

  const mime = params.output_format === 'jpeg' ? 'image/jpeg' : `image/${params.output_format}`
  return {
    images: data.data.map((img) => `data:${mime};base64,${img.b64_json}`),
    revisedPrompts: data.data.map((img) => img.revised_prompt ?? ''),
    usage: data.usage,
  }
}

export const testApiConnection = async (settings: Settings, onDevLog?: DevLogFn): Promise<string> => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 15_000)
  const url = `${getBaseUrl(settings)}/v1/models`

  try {
    onDevLog?.(`→ REQUEST\nGET ${url}\nAuthorization: Bearer [redacted]`)
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${settings.apiKey}` },
      signal: controller.signal,
    })
    await logFetchResponse(onDevLog, res)

    if (!res.ok) throw new Error(await parseError(res))
    return 'API 連線成功 / API connection succeeded'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('連線逾時 / Connection timed out')
    }
    throw e
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const looksLikeImageModel = (modelId: string) => {
  const id = modelId.toLowerCase()
  return [
    'image',
    'dall-e',
    'imagen',
    'flux',
    'stable',
    'diffusion',
    'midjourney',
    'ideogram',
    'recraft',
    'sdxl',
  ].some((keyword) => id.includes(keyword))
}

const looksLikeTextModel = (modelId: string) => {
  const id = modelId.toLowerCase()
  if (looksLikeImageModel(id)) return false
  if (id.includes('embedding') || id.includes('audio') || id.includes('tts') || id.includes('whisper')) return false
  return true
}

export const detectImageModels = async (settings: Settings, onDevLog?: DevLogFn): Promise<string[]> => {
  const url = `${getBaseUrl(settings)}/v1/models`
  onDevLog?.(`→ REQUEST\nGET ${url}\nAuthorization: Bearer [redacted]`)
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${settings.apiKey}` },
  })
  await logFetchResponse(onDevLog, res)

  if (!res.ok) throw new Error(await parseError(res))

  const data = (await res.json()) as ModelsResponse
  const models = (data.data ?? [])
    .map((model) => model.id)
    .filter((id): id is string => Boolean(id))
    .filter(looksLikeImageModel)
    .sort((a, b) => a.localeCompare(b))

  const detected = Array.from(new Set(models))
  onDevLog?.(`✓ DETECTED IMAGE MODELS\n\n${JSON.stringify(detected, null, 2)}`)
  return detected
}

export const detectTextModels = async (settings: Settings, onDevLog?: DevLogFn): Promise<string[]> => {
  const url = `${getTextBaseUrl(settings)}/v1/models`
  onDevLog?.(`→ REQUEST\nGET ${url}\nAuthorization: Bearer [redacted]`)
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${getTextApiKey(settings)}` },
  })
  await logFetchResponse(onDevLog, res)

  if (!res.ok) throw new Error(await parseError(res))

  const data = (await res.json()) as ModelsResponse
  const models = (data.data ?? [])
    .map((model) => model.id)
    .filter((id): id is string => Boolean(id))
    .filter(looksLikeTextModel)
    .sort((a, b) => a.localeCompare(b))

  const detected = Array.from(new Set(models))
  onDevLog?.(`✓ DETECTED TEXT MODELS\n\n${JSON.stringify(detected, null, 2)}`)
  return detected
}

export const optimizePrompt = async (
  settings: Settings,
  prompt: string,
  negativePrompt?: string,
  onDevLog?: DevLogFn,
): Promise<string> => {
  const model = settings.promptOptimizerModel || settings.textModels?.[0] || 'gpt-4o-mini'
  const url = `${getTextBaseUrl(settings)}/v1/chat/completions`
  const body: Record<string, unknown> = {
    model,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content: [
          'You are a professional image prompt optimizer.',
          'Rewrite the user prompt to be clearer, more visual, and more suitable for an OpenAI-compatible image generation model.',
          'Preserve the user intent and language. Do not invent important facts.',
          'Return only the optimized prompt, without markdown, quotes, headings, or explanation.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Prompt:\n${prompt}`,
          negativePrompt ? `\nNegative prompt context:\n${negativePrompt}` : '',
        ].join('\n'),
      },
    ],
  }

  const content = await chatCompletion(
    url,
    { Authorization: `Bearer ${getTextApiKey(settings)}` },
    body,
    settings.forceStreaming ?? false,
    onDevLog,
  )
  if (!content) throw new Error('提示詞優化失敗：模型沒有返回內容')
  return content
}

export const optimizeNegativePrompt = async (
  settings: Settings,
  negativePrompt: string,
  prompt?: string,
  onDevLog?: DevLogFn,
): Promise<string> => {
  const model = settings.promptOptimizerModel || settings.textModels?.[0] || 'gpt-4o-mini'
  const url = `${getTextBaseUrl(settings)}/v1/chat/completions`
  const body: Record<string, unknown> = {
    model,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: [
          'You are a professional negative prompt optimizer for image generation.',
          'Rewrite the negative prompt to be concise, clear, and effective.',
          'Keep it focused on unwanted artifacts, styles, defects, and exclusions.',
          'Preserve the user intent and language. Return only the optimized negative prompt.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          prompt ? `Main prompt context:\n${prompt}` : '',
          `Negative prompt:\n${negativePrompt}`,
        ].filter(Boolean).join('\n\n'),
      },
    ],
  }

  const content = await chatCompletion(
    url,
    { Authorization: `Bearer ${getTextApiKey(settings)}` },
    body,
    settings.forceStreaming ?? false,
    onDevLog,
  )
  if (!content) throw new Error('反向提示詞優化失敗：模型沒有返回內容')
  return content
}

export const optimizePromptPair = async (
  settings: Settings,
  prompt: string,
  negativePrompt?: string,
  onDevLog?: DevLogFn,
): Promise<{ prompt: string; negativePrompt: string }> => {
  const model = settings.promptOptimizerModel || settings.textModels?.[0] || 'gpt-4o-mini'
  const url = `${getTextBaseUrl(settings)}/v1/chat/completions`
  const useStreaming = settings.forceStreaming ?? false
  const body: Record<string, unknown> = {
    model,
    temperature: 0.35,
    // response_format json_object is incompatible with streaming on some providers; omit when streaming
    ...(useStreaming ? {} : { response_format: { type: 'json_object' } }),
    messages: [
      {
        role: 'system',
        content: [
          'You optimize image generation prompts.',
          'Optimize both the main prompt and negative prompt together so they are consistent.',
          'Preserve the user intent and language. Do not invent important facts.',
          'Return valid JSON only with exactly these string keys: "prompt" and "negative_prompt".',
          'If the negative prompt is empty, create a concise general negative prompt only when useful; otherwise return an empty string.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          prompt,
          negative_prompt: negativePrompt ?? '',
        }),
      },
    ],
  }

  const content = await chatCompletion(
    url,
    { Authorization: `Bearer ${getTextApiKey(settings)}` },
    body,
    useStreaming,
    onDevLog,
  )
  if (!content) throw new Error('提示詞優化失敗：模型沒有返回內容')

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  const jsonStr = jsonMatch ? jsonMatch[0] : content
  const parsed = JSON.parse(jsonStr) as { prompt?: unknown; negative_prompt?: unknown }
  if (typeof parsed.prompt !== 'string') throw new Error('提示詞優化失敗：返回格式無效')

  return {
    prompt: parsed.prompt,
    negativePrompt: typeof parsed.negative_prompt === 'string' ? parsed.negative_prompt : '',
  }
}

const formatUsd = (value: unknown) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value ?? '-')
  return `$${number.toFixed(4)}`
}

const formatQuota = (value: unknown) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value ?? '-')
  return number.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

const getOneApiError = (data: unknown) => {
  if (!data || typeof data !== 'object' || !('error' in data)) return null
  const error = (data as { error?: { message?: string } }).error
  return error?.message ?? 'OneAPI returned an error'
}

const sumCostBuckets = (data: unknown) => {
  if (!data || typeof data !== 'object' || !('data' in data)) return 0
  const buckets = (data as { data?: unknown[] }).data ?? []

  return buckets.reduce<number>((total, bucket) => {
    if (!bucket || typeof bucket !== 'object' || !('results' in bucket)) return total
    const results = (bucket as { results?: unknown[] }).results ?? []
    return total + results.reduce<number>((subtotal, result) => {
      if (!result || typeof result !== 'object' || !('amount' in result)) return subtotal
      const amount = (result as { amount?: { value?: number } }).amount
      return subtotal + (amount?.value ?? 0)
    }, 0)
  }, 0)
}

export const queryApiQuota = async (settings: Settings, onDevLog?: DevLogFn): Promise<QuotaResult> => {
  const baseUrl = getBaseUrl(settings)
  const headers = { Authorization: `Bearer ${settings.apiKey}` }
  const errors: string[] = []

  const oneApiPaths = [
    ['/dashboard/billing/subscription', '/dashboard/billing/usage'],
    ['/v1/dashboard/billing/subscription', '/v1/dashboard/billing/usage'],
  ] as const

  for (const [subscriptionPath, usagePath] of oneApiPaths) {
    const subscriptionUrl = `${baseUrl}${subscriptionPath}`
    onDevLog?.(`→ REQUEST\nGET ${subscriptionUrl}\nAuthorization: Bearer [redacted]`)
    const subscriptionRes = await fetch(subscriptionUrl, {
      method: 'GET',
      headers,
    }).catch((e: unknown) => {
      errors.push(`${subscriptionPath}: ${e instanceof Error ? e.message : 'request failed'}`)
      return null
    })
    if (subscriptionRes) await logFetchResponse(onDevLog, subscriptionRes, subscriptionPath)

    if (!subscriptionRes?.ok) {
      if (subscriptionRes) errors.push(`${subscriptionPath}: ${await parseError(subscriptionRes)}`)
      continue
    }

    const subscription = await subscriptionRes.json() as Record<string, unknown>
    const subscriptionError = getOneApiError(subscription)
    if (subscriptionError) {
      errors.push(`${subscriptionPath}: ${subscriptionError}`)
      continue
    }

    const usageUrl = `${baseUrl}${usagePath}`
    onDevLog?.(`→ REQUEST\nGET ${usageUrl}\nAuthorization: Bearer [redacted]`)
    const usageRes = await fetch(usageUrl, {
      method: 'GET',
      headers,
    }).catch((e: unknown) => {
      errors.push(`${usagePath}: ${e instanceof Error ? e.message : 'request failed'}`)
      return null
    })
    if (usageRes) await logFetchResponse(onDevLog, usageRes, usagePath)

    let usedQuota = 0
    if (usageRes?.ok) {
      const usage = await usageRes.json() as Record<string, unknown>
      const usageError = getOneApiError(usage)
      if (!usageError) {
        usedQuota = Number(usage.total_usage ?? 0) / 100
      } else {
        errors.push(`${usagePath}: ${usageError}`)
      }
    } else if (usageRes) {
      errors.push(`${usagePath}: ${await parseError(usageRes)}`)
    }

    const totalQuota = Number(subscription.soft_limit_usd ?? subscription.hard_limit_usd ?? subscription.system_hard_limit_usd ?? 0)
    const remainingQuota = totalQuota - usedQuota
    const accessUntil = Number(subscription.access_until ?? 0)

    return {
      source: 'oneapi-dashboard',
      summary: 'OneAPI 額度查詢成功 / OneAPI quota query succeeded',
      details: [
        `總額度 / Total quota: ${formatQuota(totalQuota)}`,
        `已使用 / Used quota: ${formatQuota(usedQuota)}`,
        `剩餘額度 / Remaining quota: ${formatQuota(remainingQuota)}`,
        accessUntil > 0
          ? `有效期至 / Access until: ${new Date(accessUntil * 1000).toLocaleString()}`
          : '有效期 / Access until: unlimited or not provided',
        '單位取決於 OneAPI 伺服器配置 / Unit depends on OneAPI server configuration',
      ],
    }
  }

  const creditUrl = `${baseUrl}/dashboard/billing/credit_grants`
  onDevLog?.(`→ REQUEST\nGET ${creditUrl}\nAuthorization: Bearer [redacted]`)
  const creditRes = await fetch(creditUrl, {
    method: 'GET',
    headers,
  }).catch((e: unknown) => {
    errors.push(`credit_grants: ${e instanceof Error ? e.message : 'request failed'}`)
    return null
  })
  if (creditRes) await logFetchResponse(onDevLog, creditRes, 'credit_grants')

  if (creditRes?.ok) {
    const data = await creditRes.json() as Record<string, unknown>
    return {
      source: 'credit_grants',
      summary: '餘額查詢成功 / Credit quota query succeeded',
      details: [
        `可用額度 / Available: ${formatUsd(data.total_available)}`,
        `總額度 / Granted: ${formatUsd(data.total_granted)}`,
        `已使用 / Used: ${formatUsd(data.total_used)}`,
      ],
    }
  }

  if (creditRes) errors.push(`credit_grants: ${await parseError(creditRes)}`)

  const startTime = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000)
  const costsUrl = `${baseUrl}/v1/organization/costs?start_time=${startTime}&bucket_width=1d&limit=31`
  onDevLog?.(`→ REQUEST\nGET ${costsUrl}\nAuthorization: Bearer [redacted]`)
  const costsRes = await fetch(costsUrl, {
    method: 'GET',
    headers,
  }).catch((e: unknown) => {
    errors.push(`organization/costs: ${e instanceof Error ? e.message : 'request failed'}`)
    return null
  })
  if (costsRes) await logFetchResponse(onDevLog, costsRes, 'organization/costs')

  if (costsRes?.ok) {
    const data = await costsRes.json()
    const monthCost = sumCostBuckets(data)
    return {
      source: 'organization/costs',
      summary: '本月成本查詢成功 / Monthly cost query succeeded',
      details: [
        `本月已產生費用 / Month-to-date cost: ${formatUsd(monthCost)}`,
        '官方 Costs API 返回成本資料，不返回剩餘額度 / Official Costs API reports cost, not remaining credit balance',
      ],
    }
  }

  if (costsRes) errors.push(`organization/costs: ${await parseError(costsRes)}`)

  throw new Error([
    '額度查詢失敗 / Quota query failed',
    '一般 OpenAI API Key 可能無權讀取組織成本，或目前服務不支援餘額介面。',
    ...errors,
  ].join('\n'))
}

export const editImages = async (
  settings: Settings,
  params: EditParams,
  imageFiles: Blob[],
  maskFile?: Blob,
  onDevLog?: DevLogFn,
): Promise<GenerateResult> => {
  const url = `${getBaseUrl(settings)}/v1/images/edits`

  const form = new FormData()
  form.append('model', params.model)
  form.append('prompt', params.prompt)
  if (params.negative_prompt) form.append('negative_prompt', params.negative_prompt)
  form.append('n', String(params.n))
  if (params.size !== 'auto') form.append('size', getImageSize(params))
  if (params.quality !== 'auto') form.append('quality', params.quality)
  form.append('output_format', params.output_format)
  if (params.output_format !== 'png') {
    form.append('output_compression', String(params.output_compression))
  }

  imageFiles.forEach((f) => form.append('image[]', f))
  if (maskFile) form.append('mask', maskFile)

  const formFields: Record<string, string> = {
    model: params.model,
    prompt: params.prompt,
    ...(params.negative_prompt ? { negative_prompt: params.negative_prompt } : {}),
    n: String(params.n),
    output_format: params.output_format,
    ...(params.size !== 'auto' ? { size: getImageSize(params) } : {}),
    ...(params.quality !== 'auto' ? { quality: params.quality } : {}),
    ...(params.output_format !== 'png' ? { output_compression: String(params.output_compression) } : {}),
    'image[]': `[${imageFiles.length} file(s)]`,
    ...(maskFile ? { mask: '[1 file]' } : {}),
  }
  onDevLog?.(`→ REQUEST\nPOST ${url}\nContent-Type: multipart/form-data\n\n${JSON.stringify(formFields, null, 2)}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.apiKey}` },
    body: form,
  })

  if (!res.ok) {
    const errText = await parseError(res)
    onDevLog?.(`← RESPONSE ${res.status} ${res.statusText}\n\n${errText}`)
    throw new Error(errText)
  }

  const data = (await res.json()) as ImageResponse
  onDevLog?.(`← RESPONSE ${res.status} ${res.statusText}\n\n${JSON.stringify(data, null, 2)}`)

  const mime = params.output_format === 'jpeg' ? 'image/jpeg' : `image/${params.output_format}`
  return {
    images: data.data.map((img) => `data:${mime};base64,${img.b64_json}`),
    revisedPrompts: data.data.map((img) => img.revised_prompt ?? ''),
    usage: data.usage,
  }
}
