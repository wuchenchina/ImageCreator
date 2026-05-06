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
  Upload,
  Space,
  Tag,
  Flex,
  Statistic,
  AutoComplete,
  message,
} from 'antd'
import {
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { useAppContext } from '../context/AppContext'
import { editImages, optimizeNegativePrompt, optimizePrompt, optimizePromptPair } from '../utils/api'
import ImageResultCard from './ImageResultCard'
import type { EditParams, TokenUsage } from '../types'
import { FORMAT_OPTIONS, getImageSize, QUALITY_OPTIONS, SIZE_OPTIONS, validateCustomSize } from '../utils/imageOptions'
import { formatElapsed, useElapsedSeconds } from '../hooks/useElapsedSeconds'
import PromptTemplateSelector from './PromptTemplateSelector'
import { dataUrlToBlob, estimateReferenceImageTokens, estimateTextTokens } from '../utils/tokenEstimate'

const { TextArea } = Input
const { Dragger } = Upload

const defaultValues: EditParams = {
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
}

export default function EditPage() {
  const { settings, addHistory, addLog, recordUsage } = useAppContext()
  const [form] = Form.useForm<EditParams>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<string[]>([])
  const [revisedPrompts, setRevisedPrompts] = useState<string[]>([])
  const [lastUsage, setLastUsage] = useState<TokenUsage | undefined>()
  const [format, setFormat] = useState<string>('png')
  const [imageFiles, setImageFiles] = useState<UploadFile[]>([])
  const [maskFile, setMaskFile] = useState<UploadFile | null>(null)
  const [referenceImageTokens, setReferenceImageTokens] = useState(0)
  const [optimizingPrompt, setOptimizingPrompt] = useState(false)
  const [optimizingNegativePrompt, setOptimizingNegativePrompt] = useState(false)
  const [optimizingPromptPair, setOptimizingPromptPair] = useState(false)
  const [revisionPrompt, setRevisionPrompt] = useState('')
  const [revising, setRevising] = useState(false)
  const elapsedSeconds = useElapsedSeconds(loading)

  const outputFormat = Form.useWatch('output_format', form)
  const selectedSize = Form.useWatch('size', form)
  const customWidth = Form.useWatch('custom_width', form)
  const customHeight = Form.useWatch('custom_height', form)
  const watchedPrompt = Form.useWatch('prompt', form) ?? ''
  const watchedNegPrompt = Form.useWatch('negative_prompt', form) ?? ''
  const modelOptions = (settings.imageModels ?? ['gpt-image-2'])
    .map((model) => ({ value: model, label: model }))

  useEffect(() => {
    const files = imageFiles
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
  }, [imageFiles])

  const handleSubmit = async () => {
    if (!settings.apiKey) {
      setError('請先在設定中設定 API Key')
      return
    }
    if (imageFiles.length === 0) {
      setError('請至少上傳一張參考圖片')
      return
    }

    const values = await form.validateFields()
    setLoading(true)
    setError(null)
    setResults([])
    setRevisedPrompts([])
    setLastUsage(undefined)
    const startedAt = Date.now()
    const devLogs: string[] = []

    try {
      const rawImages = imageFiles
        .map((f) => f.originFileObj)
        .filter((f): f is NonNullable<typeof f> => Boolean(f))

      const rawMask = maskFile?.originFileObj ?? undefined
      const onDevLog = (detail: string) => devLogs.push(detail)

      const result = await editImages(settings, values, rawImages, rawMask, onDevLog)
      setResults(result.images)
      setRevisedPrompts(result.revisedPrompts)
      setLastUsage(result.usage)
      setFormat(values.output_format)
      const duration = Math.round((Date.now() - startedAt) / 1000)
      const usageStr = result.usage?.total_tokens ? `, tokens=${result.usage.total_tokens}` : ''
      const detail = [
        `/v1/images/edits, references=${rawImages.length}, mask=${rawMask ? 'yes' : 'no'}, size=${getImageSize(values)}, quality=${values.quality}`,
        ...devLogs,
      ].join('\n\n---\n\n')
      addLog('success', `編輯完成 / Edit completed: ${result.images.length} image(s), ${duration}s${usageStr}`, detail)
      recordUsage(result.images.length, result.usage?.input_tokens, result.usage?.output_tokens)

      const id = `edit-${Date.now()}`
      await addHistory(
        {
          id,
          type: 'edit',
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
      const error = e instanceof Error ? e.message : '編輯失敗，請重試 / Edit failed, please retry'
      setError(error)
      const duration = Math.round((Date.now() - startedAt) / 1000)
      addLog('error', `編輯失敗 / Edit failed: ${error}, ${duration}s`, devLogs.join('\n\n---\n\n'))
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
    const devLogsOpt: string[] = []

    try {
      const onDevLog = (detail: string) => devLogsOpt.push(detail)
      const optimized = await optimizePrompt(settings, prompt, form.getFieldValue('negative_prompt'), onDevLog)
      form.setFieldValue('prompt', optimized)
      message.success('Prompt 已優化')
      addLog('success', 'Prompt 優化完成 / Prompt optimization completed', devLogsOpt.join('\n\n---\n\n'))
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Prompt 優化失敗'
      message.error(error)
      addLog('error', error, devLogsOpt.join('\n\n---\n\n'))
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
    const devLogsNeg: string[] = []

    try {
      const onDevLog = (detail: string) => devLogsNeg.push(detail)
      const optimized = await optimizeNegativePrompt(settings, negativePrompt, form.getFieldValue('prompt'), onDevLog)
      form.setFieldValue('negative_prompt', optimized)
      message.success('反向 Prompt 已優化')
      addLog('success', '反向 Prompt 優化完成 / Negative prompt optimization completed', devLogsNeg.join('\n\n---\n\n'))
    } catch (e) {
      const error = e instanceof Error ? e.message : '反向 Prompt 優化失敗'
      message.error(error)
      addLog('error', error, devLogsNeg.join('\n\n---\n\n'))
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
    const devLogsPair: string[] = []

    try {
      const onDevLog = (detail: string) => devLogsPair.push(detail)
      const optimized = await optimizePromptPair(settings, prompt, form.getFieldValue('negative_prompt'), onDevLog)
      form.setFieldsValue({
        prompt: optimized.prompt,
        negative_prompt: optimized.negativePrompt,
      })
      message.success('提示詞已同時優化')
      addLog('success', '提示詞與反向提示詞優化完成 / Prompt pair optimization completed', devLogsPair.join('\n\n---\n\n'))
    } catch (e) {
      const error = e instanceof Error ? e.message : '提示詞優化失敗'
      message.error(error)
      addLog('error', error, devLogsPair.join('\n\n---\n\n'))
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
    const devLogs: string[] = []

    try {
      const values = await form.validateFields()
      const imageBlobs = await Promise.all(results.map(dataUrlToBlob))
      const prompt = [
        values.prompt,
        '根據參考圖片進行修改，保持整體風格與主要內容一致。',
        `修改要求：${revision}`,
      ].join('\n\n')
      const onDevLog = (detail: string) => devLogs.push(detail)
      const result = await editImages(settings, { ...values, prompt }, imageBlobs, undefined, onDevLog)
      setResults(result.images)
      setRevisedPrompts(result.revisedPrompts)
      setLastUsage(result.usage)
      setFormat(values.output_format)
      setRevisionPrompt('')
      const duration = Math.round((Date.now() - startedAt) / 1000)
      const usageStr = result.usage?.total_tokens ? `, tokens=${result.usage.total_tokens}` : ''
      const detail = [`references=${imageBlobs.length}`, ...devLogs].join('\n\n---\n\n')
      addLog('success', `修改完成 / Revision completed: ${result.images.length} image(s), ${duration}s${usageStr}`, detail)
      recordUsage(result.images.length, result.usage?.input_tokens, result.usage?.output_tokens)
    } catch (e) {
      const error = e instanceof Error ? e.message : '修改失敗，請重試 / Revision failed, please retry'
      setError(error)
      addLog('error', `修改失敗 / Revision failed: ${error}`, devLogs.join('\n\n---\n\n'))
    } finally {
      setRevising(false)
    }
  }

  const imageUploadProps: UploadProps = {
    accept: 'image/png,image/jpeg,image/webp',
    multiple: true,
    fileList: imageFiles,
    beforeUpload: () => false,
    onChange: ({ fileList }) => setImageFiles(fileList),
    listType: 'picture-card',
    showUploadList: {
      showPreviewIcon: true,
      showRemoveIcon: true,
    },
  }

  const maskUploadProps: UploadProps = {
    accept: 'image/png',
    multiple: false,
    fileList: maskFile ? [maskFile] : [],
    beforeUpload: () => false,
    onChange: ({ fileList }) => setMaskFile(fileList[fileList.length - 1] ?? null),
    maxCount: 1,
  }

  return (
    <Row gutter={32}>
      <Col xs={24} lg={11}>
        <Card>
          <Form form={form} layout="vertical" initialValues={defaultValues}>
            <Form.Item
              label="參考圖片 / Reference Images"
              required
              extra="支援 PNG、JPEG、WebP，最多 16 張，每張不超過 50MB / Supports PNG, JPEG, WebP, up to 16 images, under 50MB each"
            >
              <Dragger {...imageUploadProps}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">點擊或拖曳上傳參考圖片 / Click or drag reference images</p>
                <p className="ant-upload-hint">可上傳多張圖片作為參考 / Multiple reference images are supported</p>
              </Dragger>
            </Form.Item>

            {imageFiles.length > 0 && (
              <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
                <Space wrap>
                  {imageFiles.map((f, i) => (
                    <Tag
                      key={f.uid}
                      closable
                      onClose={() => setImageFiles((prev) => prev.filter((_, idx) => idx !== i))}
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
              rules={[{ required: true, message: '請輸入編輯指令 / Please enter edit instructions' }]}
              extra={
                <Typography.Text type="secondary" style={{ float: 'right', fontSize: 12 }}>
                  {watchedPrompt.length}/32000 字 · ~{estimateTextTokens(watchedPrompt)} tokens
                </Typography.Text>
              }
            >
              <TextArea
                rows={4}
                placeholder="描述你想要的編輯效果，例如：將背景替換為海邊日落場景"
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
              label="遮罩圖片（可選）/ Mask Image (Optional)"
              extra="PNG 格式，需含透明通道（Alpha）。透明區域將被編輯，不透明區域保持原樣 / PNG with alpha channel required"
            >
              <Upload {...maskUploadProps}>
                <Button icon={<PlusOutlined />}>上傳遮罩 / Upload Mask</Button>
              </Upload>
              {maskFile && (
                <Space>
                  <Tag
                    closable
                    onClose={() => setMaskFile(null)}
                    icon={<DeleteOutlined />}
                  >
                    {maskFile.name}
                  </Tag>
                </Space>
              )}
            </Form.Item>

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
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="寬度 / Width"
                    name="custom_width"
                    rules={[
                      {
                        validator: () => {
                          const error = validateCustomSize(customWidth, customHeight)
                          return error ? Promise.reject(new Error(error)) : Promise.resolve()
                        },
                      },
                    ]}
                  >
                    <InputNumber min={16} max={3840} step={16} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="高度 / Height"
                    name="custom_height"
                    rules={[
                      {
                        validator: () => {
                          const error = validateCustomSize(customWidth, customHeight)
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
              <Form.Item
                label={`壓縮品質 / Compression (${form.getFieldValue('output_compression') ?? 85}%)`}
                name="output_compression"
              >
                <Slider min={0} max={100} />
              </Form.Item>
            )}

            {error && <Alert type="error" message={error} showIcon />}

            <Form.Item>
              <Button
                type="primary"
                icon={<EditOutlined />}
                loading={loading}
                block
                size="large"
                onClick={handleSubmit}
              >
                {loading ? '處理中...' : '開始編輯'}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={13}>
        <Card title="結果 / Results">
          {loading && (
            <Flex vertical align="center" justify="center" gap="middle" style={{ minHeight: 320 }}>
              <Spin size="large" />
              <Typography.Text type="secondary">
                正在處理圖片，高品質圖片可能需要 1-2 分鐘... / Processing image, high quality may take 1-2 minutes...
              </Typography.Text>
              <Typography.Text strong>
                創作計時 / Creation Timer：{formatElapsed(elapsedSeconds)}
              </Typography.Text>
            </Flex>
          )}

          {!loading && results.length > 0 && (
            <>
              <Flex align="center" justify="space-between" wrap="wrap" gap="small">
                <Typography.Text strong>{results.length} 張結果</Typography.Text>
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

          {!loading && results.length === 0 && (
            <Flex vertical align="center">
              <Typography.Title level={5} type="secondary">
                使用說明
              </Typography.Title>
              <Typography.Paragraph type="secondary">
                <ul>
                  <li>上傳一張或多張參考圖片，模型將以這些圖片為參考生成新圖片</li>
                  <li>可提供遮罩圖片，透明區域將被修改，其餘區域保持原樣</li>
                  <li>遮罩必須為 PNG 格式並包含 Alpha 透明通道</li>
                  <li>遮罩將應用於第一張參考圖片</li>
                </ul>
              </Typography.Paragraph>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={false}
              />
            </Flex>
          )}
        </Card>
      </Col>
    </Row>
  )
}
