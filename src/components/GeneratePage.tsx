import { useEffect, useState } from 'react'
import {
  Form,
  Input,
  Select,
  Slider,
  InputNumber,
  Button,
  Row,
  Col,
  Typography,
  Spin,
  Alert,
  Empty,
  Divider,
  Card,
  Space,
  Flex,
  Upload,
  Tag,
  Tooltip,
  Statistic,
  AutoComplete,
  message,
} from 'antd'
import { InboxOutlined, ThunderboltOutlined, SwapOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { useAppContext } from '../context/AppContext'
import { editImages, generateImages, optimizeNegativePrompt, optimizePrompt, optimizePromptPair } from '../utils/api'
import ImageResultCard from './ImageResultCard'
import PromptTemplateSelector from './PromptTemplateSelector'
import type { GenerateParams, TokenUsage } from '../types'
import { FORMAT_OPTIONS, getImageSize, QUALITY_OPTIONS, SIZE_OPTIONS, validateCustomSize } from '../utils/imageOptions'
import { formatElapsed, useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { dataUrlToBlob, estimateReferenceImageTokens, estimateTextTokens } from '../utils/tokenEstimate'

const { TextArea } = Input
const { Dragger } = Upload

const MODERATION_OPTIONS = [
  { value: 'auto', label: '標準 / Standard' },
  { value: 'low', label: '寬鬆 / Low' },
]

const defaultValues: GenerateParams = {
  model: 'gpt-image-2',
  prompt: '',
  negative_prompt: '',
  n: 1,
  size: 'auto',
  custom_width: 1024,
  custom_height: 1024,
  quality: 'auto',
  output_format: 'png',
  output_compression: 85,
  moderation: 'auto',
}

export default function GeneratePage() {
  const { settings, addHistory, addLog, recordUsage } = useAppContext()
  const [form] = Form.useForm<GenerateParams>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<string[]>([])
  const [revisedPrompts, setRevisedPrompts] = useState<string[]>([])
  const [lastUsage, setLastUsage] = useState<TokenUsage | undefined>()
  const [format, setFormat] = useState<string>('png')
  const [referenceFiles, setReferenceFiles] = useState<UploadFile[]>([])
  const [referenceImageTokens, setReferenceImageTokens] = useState(0)
  const [optimizingPrompt, setOptimizingPrompt] = useState(false)
  const [optimizingNegativePrompt, setOptimizingNegativePrompt] = useState(false)
  const [optimizingPromptPair, setOptimizingPromptPair] = useState(false)
  const [revisionPrompt, setRevisionPrompt] = useState('')
  const [revising, setRevising] = useState(false)
  const elapsedSeconds = useElapsedSeconds(loading)

  useEffect(() => {
    const files = referenceFiles
      .map((f) => f.originFileObj)
      .filter((f): f is NonNullable<typeof f> => Boolean(f))

    if (files.length === 0) {
      setReferenceImageTokens(0)
      return
    }

    let cancelled = false
    estimateReferenceImageTokens(files).then((tokens) => {
      if (!cancelled) setReferenceImageTokens(tokens)
    })

    return () => {
      cancelled = true
    }
  }, [referenceFiles])

  const handleGenerate = async () => {
    if (!settings.apiKey) {
      setError('請先在設定中設定 API Key')
      return
    }

    const values = await form.validateFields()
    setLoading(true)
    setError(null)
    setResults([])
    setRevisedPrompts([])
    setLastUsage(undefined)
    const startedAt = Date.now()
    const allDevLogs: string[] = []
    const responseLogs: string[] = []

    try {
      const references = referenceFiles
        .map((f) => f.originFileObj)
        .filter((f): f is NonNullable<typeof f> => Boolean(f))
      const endpoint = references.length > 0 ? '/v1/images/edits' : '/v1/images/generations'
      const startMsg = `開始生成 / Start generation: ${endpoint}, size=${getImageSize(values)}, quality=${values.quality}, n=${values.n}`
      let startLogged = false
      const onDevLog = (detail: string) => {
        allDevLogs.push(detail)
        if (!startLogged && detail.startsWith('→ REQUEST')) {
          startLogged = true
          addLog('info', startMsg, detail)
        } else {
          responseLogs.push(detail)
        }
      }
      const result = references.length > 0
        ? await editImages(settings, values, references, undefined, onDevLog)
        : await generateImages(settings, values, onDevLog)
      if (!startLogged) addLog('info', startMsg)
      setResults(result.images)
      setRevisedPrompts(result.revisedPrompts)
      setLastUsage(result.usage)
      setFormat(values.output_format)
      const duration = Math.round((Date.now() - startedAt) / 1000)
      const usageStr = result.usage?.total_tokens ? `, tokens=${result.usage.total_tokens}` : ''
      addLog('success', `生成完成 / Generation completed: ${result.images.length} image(s), ${duration}s${usageStr}`, responseLogs.join('\n\n---\n\n') || undefined)
      recordUsage(result.images.length, result.usage?.input_tokens, result.usage?.output_tokens)

      const id = `gen-${Date.now()}`
      await addHistory(
        {
          id,
          type: 'generate',
          prompt: values.prompt,
          createdAt: Date.now(),
          model: values.model,
          size: getImageSize(values),
          quality: values.quality,
          count: result.images.length,
        },
        result.images,
      )
    } catch (e) {
      const error = e instanceof Error ? e.message : '生成失敗，請重試 / Generation failed, please retry'
      setError(error)
      const duration = Math.round((Date.now() - startedAt) / 1000)
      addLog('error', `生成失敗 / Generation failed: ${error}, ${duration}s`, allDevLogs.join('\n\n---\n\n') || undefined)
    } finally {
      setLoading(false)
    }
  }

  const handleOptimizePrompt = async () => {
    const prompt = form.getFieldValue('prompt')?.trim()
    if (!prompt) {
      message.warning('請先輸入提示詞')
      return
    }

    setOptimizingPrompt(true)
    const allLogs1: string[] = []
    const responseLogs1: string[] = []

    try {
      let startLogged = false
      const onDevLog = (detail: string) => {
        allLogs1.push(detail)
        if (!startLogged && detail.startsWith('→ REQUEST')) {
          startLogged = true
          addLog('info', 'Prompt 優化中 / Optimizing prompt', detail)
        } else {
          responseLogs1.push(detail)
        }
      }
      const optimized = await optimizePrompt(settings, prompt, form.getFieldValue('negative_prompt'), onDevLog)
      if (!startLogged) addLog('info', 'Prompt 優化中 / Optimizing prompt')
      form.setFieldValue('prompt', optimized)
      message.success('Prompt 已優化')
      addLog('success', 'Prompt 優化完成 / Prompt optimization completed', responseLogs1.join('\n\n---\n\n') || undefined)
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Prompt 優化失敗'
      message.error(error)
      addLog('error', error, allLogs1.join('\n\n---\n\n') || undefined)
    } finally {
      setOptimizingPrompt(false)
    }
  }

  const handleOptimizeNegativePrompt = async () => {
    const negativePrompt = form.getFieldValue('negative_prompt')?.trim()
    if (!negativePrompt) {
      message.warning('請先輸入反向提示詞')
      return
    }

    setOptimizingNegativePrompt(true)
    const allLogs2: string[] = []
    const responseLogs2: string[] = []

    try {
      let startLogged = false
      const onDevLog = (detail: string) => {
        allLogs2.push(detail)
        if (!startLogged && detail.startsWith('→ REQUEST')) {
          startLogged = true
          addLog('info', '反向 Prompt 優化中 / Optimizing negative prompt', detail)
        } else {
          responseLogs2.push(detail)
        }
      }
      const optimized = await optimizeNegativePrompt(settings, negativePrompt, form.getFieldValue('prompt'), onDevLog)
      if (!startLogged) addLog('info', '反向 Prompt 優化中 / Optimizing negative prompt')
      form.setFieldValue('negative_prompt', optimized)
      message.success('反向 Prompt 已優化')
      addLog('success', '反向 Prompt 優化完成 / Negative prompt optimization completed', responseLogs2.join('\n\n---\n\n') || undefined)
    } catch (e) {
      const error = e instanceof Error ? e.message : '反向 Prompt 優化失敗'
      message.error(error)
      addLog('error', error, allLogs2.join('\n\n---\n\n') || undefined)
    } finally {
      setOptimizingNegativePrompt(false)
    }
  }

  const handleOptimizePromptPair = async () => {
    const prompt = form.getFieldValue('prompt')?.trim()
    if (!prompt) {
      message.warning('請先輸入提示詞')
      return
    }

    setOptimizingPromptPair(true)
    const allLogs3: string[] = []
    const responseLogs3: string[] = []

    try {
      let startLogged = false
      const onDevLog = (detail: string) => {
        allLogs3.push(detail)
        if (!startLogged && detail.startsWith('→ REQUEST')) {
          startLogged = true
          addLog('info', '提示詞同時優化中 / Optimizing prompt pair', detail)
        } else {
          responseLogs3.push(detail)
        }
      }
      const optimized = await optimizePromptPair(settings, prompt, form.getFieldValue('negative_prompt'), onDevLog)
      if (!startLogged) addLog('info', '提示詞同時優化中 / Optimizing prompt pair')
      form.setFieldsValue({
        prompt: optimized.prompt,
        negative_prompt: optimized.negativePrompt,
      })
      message.success('提示詞已同時優化')
      addLog('success', '提示詞與反向提示詞優化完成 / Prompt pair optimization completed', responseLogs3.join('\n\n---\n\n') || undefined)
    } catch (e) {
      const error = e instanceof Error ? e.message : '提示詞優化失敗'
      message.error(error)
      addLog('error', error, allLogs3.join('\n\n---\n\n') || undefined)
    } finally {
      setOptimizingPromptPair(false)
    }
  }

  const handleReviseResults = async () => {
    const revision = revisionPrompt.trim()
    if (!revision) {
      message.warning('請輸入想修改的地方')
      return
    }
    if (results.length === 0) return

    setRevising(true)
    setError(null)
    const startedAt = Date.now()
    const allLogs4: string[] = []
    const responseLogs4: string[] = []

    try {
      const values = await form.validateFields()
      const imageBlobs = await Promise.all(results.map(dataUrlToBlob))
      const prompt = [
        values.prompt,
        '根據參考圖片進行修改，保持整體風格與主要內容一致。',
        `修改要求：${revision}`,
      ].join('\n\n')
      const startMsg = `開始根據結果修改 / Start result revision: references=${imageBlobs.length}`
      let startLogged = false
      const onDevLog = (detail: string) => {
        allLogs4.push(detail)
        if (!startLogged && detail.startsWith('→ REQUEST')) {
          startLogged = true
          addLog('info', startMsg, detail)
        } else {
          responseLogs4.push(detail)
        }
      }
      const result = await editImages(settings, { ...values, prompt }, imageBlobs, undefined, onDevLog)
      if (!startLogged) addLog('info', startMsg)
      setResults(result.images)
      setRevisedPrompts(result.revisedPrompts)
      setLastUsage(result.usage)
      setFormat(values.output_format)
      setRevisionPrompt('')
      const duration = Math.round((Date.now() - startedAt) / 1000)
      const usageStr = result.usage?.total_tokens ? `, tokens=${result.usage.total_tokens}` : ''
      addLog('success', `修改完成 / Revision completed: ${result.images.length} image(s), ${duration}s${usageStr}`, responseLogs4.join('\n\n---\n\n') || undefined)
      recordUsage(result.images.length, result.usage?.input_tokens, result.usage?.output_tokens)
    } catch (e) {
      const error = e instanceof Error ? e.message : '修改失敗，請重試 / Revision failed, please retry'
      setError(error)
      addLog('error', `修改失敗 / Revision failed: ${error}`, allLogs4.join('\n\n---\n\n') || undefined)
    } finally {
      setRevising(false)
    }
  }

  const outputFormat = Form.useWatch('output_format', form)
  const selectedSize = Form.useWatch('size', form)
  const watchedPrompt = Form.useWatch('prompt', form) ?? ''
  const watchedNegPrompt = Form.useWatch('negative_prompt', form) ?? ''
  const modelOptions = (settings.imageModels ?? ['gpt-image-2'])
    .map((model) => ({ value: model, label: model }))

  const referenceUploadProps: UploadProps = {
    accept: 'image/png,image/jpeg,image/webp',
    multiple: true,
    fileList: referenceFiles,
    beforeUpload: () => false,
    onChange: ({ fileList }) => setReferenceFiles(fileList),
    listType: 'picture-card',
  }

  return (
    <Row gutter={32}>
      <Col xs={24} lg={10}>
        <Card>
          <Form
            form={form}
            layout="vertical"
            initialValues={defaultValues}
            onFinish={handleGenerate}
          >
            <Form.Item label="提示詞範本 / Prompt Template">
              <PromptTemplateSelector
                onApply={({ prompt, negativePrompt }) => {
                  form.setFieldValue('prompt', prompt)
                  if (negativePrompt) form.setFieldValue('negative_prompt', negativePrompt)
                }}
              />
            </Form.Item>

            <Form.Item
              label="提示詞 / Prompt"
              name="prompt"
              rules={[{ required: true, message: '請輸入提示詞 / Please enter a prompt' }]}
              extra={
                <Typography.Text type="secondary" style={{ float: 'right', fontSize: 12 }}>
                  {watchedPrompt.length}/32000 字 · ~{estimateTextTokens(watchedPrompt)} tokens
                </Typography.Text>
              }
            >
              <TextArea
                rows={5}
                placeholder="描述你想要生成的圖片，例如：一隻灰色虎斑貓抱著一隻戴橙色圍巾的水獺"
                maxLength={32000}
              />
            </Form.Item>

            <Form.Item
              label="反向提示詞 / Negative Prompt"
              name="negative_prompt"
              extra={
                <>
                  <span style={{ float: 'right', fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                    {watchedNegPrompt.length}/4000 字 · ~{estimateTextTokens(watchedNegPrompt)} tokens
                  </span>
                  <span>描述不希望出現在圖片中的內容（部分模型支援）/ Describe what you want to exclude (model-dependent)</span>
                </>
              }
            >
              <TextArea
                rows={3}
                placeholder="例如：模糊、變形、低品質、文字、浮水印 / e.g. blurry, distorted, low quality, text, watermark"
                maxLength={4000}
              />
            </Form.Item>

            <Flex justify="flex-end" gap="small" wrap style={{ marginBottom: 16 }}>
              <Button size="small" type="primary" onClick={handleOptimizePromptPair} loading={optimizingPromptPair}>
                一鍵優化兩個提示詞
              </Button>
              <Button size="small" onClick={handleOptimizePrompt} loading={optimizingPrompt}>
                優化提示詞
              </Button>
              <Button size="small" onClick={handleOptimizeNegativePrompt} loading={optimizingNegativePrompt}>
                優化反向提示詞
              </Button>
            </Flex>

            <Form.Item
              label="參考圖片（可選）/ Reference Images (Optional)"
              extra="上傳後將使用官方圖片編輯介面，以參考圖生成新圖片 / Uses the official image edits endpoint when references are provided"
            >
              <Dragger {...referenceUploadProps}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">點擊或拖曳上傳參考圖片 / Click or drag reference images</p>
                <p className="ant-upload-hint">支援多張 PNG、JPEG、WebP 圖片 / Supports multiple PNG, JPEG, WebP images</p>
              </Dragger>
            </Form.Item>

            {referenceFiles.length > 0 && (
              <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
                <Space wrap>
                  {referenceFiles.map((f, i) => (
                    <Tag
                      key={f.uid}
                      closable
                      onClose={() => setReferenceFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      {f.name}
                    </Tag>
                  ))}
                </Space>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  參考圖片預計：~{referenceImageTokens} tokens
                </Typography.Text>
              </Space>
            )}

            <Form.Item label="模型 / Model" name="model">
              <AutoComplete
                options={modelOptions}
                placeholder="選擇或輸入模型 ID / Select or enter model ID"
                filterOption={(inputValue, option) =>
                  String(option?.value ?? '').toLowerCase().includes(inputValue.toLowerCase())
                }
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="尺寸 / Size" name="size">
                  <Select options={SIZE_OPTIONS} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="品質 / Quality" name="quality">
                  <Select options={QUALITY_OPTIONS} />
                </Form.Item>
              </Col>
            </Row>

            {selectedSize === 'custom' && (
              <Row gutter={8} align="bottom" wrap={false}>
                <Col flex="1">
                  <Form.Item
                    label="寬度 / Width"
                    name="custom_width"
                    validateTrigger="onBlur"
                    rules={[
                      {
                        validator: () => {
                          const w = form.getFieldValue('custom_width')
                          const h = form.getFieldValue('custom_height')
                          const error = validateCustomSize(w, h)
                          return error ? Promise.reject(new Error(error)) : Promise.resolve()
                        },
                      },
                    ]}
                  >
                    <InputNumber min={16} max={3840} step={16} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col flex="none" style={{ paddingBottom: 24 }}>
                  <Tooltip title="橫豎屏切換 / Swap Width & Height">
                    <Button
                      type="text"
                      icon={<SwapOutlined />}
                      onClick={() => {
                        const w = form.getFieldValue('custom_width')
                        const h = form.getFieldValue('custom_height')
                        form.setFieldsValue({ custom_width: h, custom_height: w })
                        form.validateFields(['custom_width', 'custom_height'])
                      }}
                    />
                  </Tooltip>
                </Col>
                <Col flex="1">
                  <Form.Item
                    label="高度 / Height"
                    name="custom_height"
                    validateTrigger="onBlur"
                    rules={[
                      {
                        validator: () => {
                          const w = form.getFieldValue('custom_width')
                          const h = form.getFieldValue('custom_height')
                          const error = validateCustomSize(w, h)
                          return error ? Promise.reject(new Error(error)) : Promise.resolve()
                        },
                      },
                    ]}
                  >
                    <InputNumber min={16} max={3840} step={16} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            )}

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="輸出格式 / Output Format" name="output_format">
                  <Select options={FORMAT_OPTIONS} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="生成數量 / Number of Images" name="n">
                  <InputNumber min={1} max={10} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            {(outputFormat === 'jpeg' || outputFormat === 'webp') && (
              <Form.Item label={`壓縮品質 / Compression (${form.getFieldValue('output_compression') ?? 85}%)`} name="output_compression">
                <Slider min={0} max={100} />
              </Form.Item>
            )}

            <Form.Item label="內容審核 / Moderation" name="moderation" extra="寬鬆模式允許更多內容類型 / Low allows more content categories">
              <Select options={MODERATION_OPTIONS} />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                icon={<ThunderboltOutlined />}
                loading={loading}
                block
                size="large"
              >
                {loading ? '生成中...' : '生成圖片'}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={14}>
        <Card title="結果 / Results">
          {loading && (
            <Flex vertical align="center" justify="center" gap="middle" style={{ minHeight: 320 }}>
              <Spin size="large" />
              <Typography.Text type="secondary">
                正在生成圖片，高品質圖片可能需要 1-2 分鐘... / Generating image, high quality may take 1-2 minutes...
              </Typography.Text>
              <Typography.Text strong>
                創作計時 / Creation Timer：{formatElapsed(elapsedSeconds)}
              </Typography.Text>
            </Flex>
          )}

          {error && !loading && (
            <Alert type="error" message={error} showIcon />
          )}

          {!loading && results.length > 0 && (
            <>
              <Flex align="center" justify="space-between" wrap="wrap" gap="small">
                <Typography.Text strong>{results.length} 張圖片</Typography.Text>
                {lastUsage && (
                  <Space size="large">
                    {lastUsage.input_tokens !== undefined && (
                      <Statistic title="輸入 Token" value={lastUsage.input_tokens} valueStyle={{ fontSize: 14 }} />
                    )}
                    {lastUsage.output_tokens !== undefined && (
                      <Statistic title="輸出 Token" value={lastUsage.output_tokens} valueStyle={{ fontSize: 14 }} />
                    )}
                    {lastUsage.total_tokens !== undefined && (
                      <Statistic title="總計 Token" value={lastUsage.total_tokens} valueStyle={{ fontSize: 14, color: '#1677ff' }} />
                    )}
                  </Space>
                )}
              </Flex>
              <Divider />
              <Row gutter={[16, 16]}>
                {results.map((url, i) => (
                  <Col key={i} xs={24} sm={results.length === 1 ? 24 : 12}>
                    <ImageResultCard dataUrl={url} index={i} format={format} />
                    {revisedPrompts[i] && (
                      <Typography.Paragraph
                        type="secondary"
                        style={{ fontSize: 12, marginTop: 6 }}
                        ellipsis={{ rows: 3, expandable: true, symbol: '展開 / expand' }}
                      >
                        <Typography.Text type="secondary" strong style={{ fontSize: 12 }}>
                          Revised prompt:{' '}
                        </Typography.Text>
                        {revisedPrompts[i]}
                      </Typography.Paragraph>
                    )}
                  </Col>
                ))}
              </Row>
              <Divider />
              <Card size="small" title="對結果不滿意？繼續修改 / Continue Refining">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <TextArea
                    rows={3}
                    value={revisionPrompt}
                    onChange={(e) => setRevisionPrompt(e.target.value)}
                    placeholder="描述想修改的地方，例如：背景更簡潔、人物表情更自然、移除文字水印..."
                    maxLength={4000}
                  />
                  <Flex justify="space-between" align="center" wrap gap="small">
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      會把目前結果作為參考圖片，使用圖片編輯介面重新生成
                    </Typography.Text>
                    <Button type="primary" loading={revising} onClick={handleReviseResults}>
                      根據意見修改
                    </Button>
                  </Flex>
                </Space>
              </Card>
            </>
          )}

          {!loading && results.length === 0 && !error && (
            <Flex justify="center">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="填寫左側參數，點擊生成圖片"
              />
            </Flex>
          )}
        </Card>
      </Col>
    </Row>
  )
}
