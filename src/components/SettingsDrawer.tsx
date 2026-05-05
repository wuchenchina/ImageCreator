import { useEffect, useState } from 'react'
import { Drawer, Form, Input, Button, Space, Typography, Divider, Alert, message, List, Card, Flex, Grid, Select, Radio } from 'antd'
import { CopyOutlined, ImportOutlined, LinkOutlined, WalletOutlined, SafetyOutlined } from '@ant-design/icons'

const { useBreakpoint } = Grid
import { useAppContext } from '../context/AppContext'
import type { Settings } from '../types'
import { detectImageModels, detectTextModels, queryApiQuota, testApiConnection, type QuotaResult } from '../utils/api'
import { encodeSettingsShare, decodeSettingsShare } from '../utils/settingsShare'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsDrawer({ open, onClose }: Props) {
  const { settings, updateSettings, addLog } = useAppContext()
  const [form] = Form.useForm<Settings>()
  const [testing, setTesting] = useState(false)
  const [checkingQuota, setCheckingQuota] = useState(false)
  const [detectingModels, setDetectingModels] = useState(false)
  const [detectingTextModels, setDetectingTextModels] = useState(false)
  const [quotaResult, setQuotaResult] = useState<QuotaResult | null>(null)
  const [sharePaste, setSharePaste] = useState('')
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const textApiMode = Form.useWatch('textApiMode', form) ?? 'same'

  useEffect(() => {
    if (open) {
      form.setFieldsValue(settings)
      setQuotaResult(null)
    }
  }, [open, settings, form])

  const handleSave = () => {
    form.validateFields().then((values) => {
      updateSettings(values)
      onClose()
    })
  }

  const handleTest = async () => {
    const values = await form.validateFields()
    setTesting(true)
    addLog('info', `測試 API 連通性 / Testing API connection: ${values.apiBaseUrl}`)

    try {
      const onDevLog = (detail: string) => addLog('info', '[Dev] API Log', detail)
      const result = await testApiConnection(values, onDevLog)
      message.success(result)
      addLog('success', result)
    } catch (e) {
      const error = e instanceof Error ? e.message : 'API 連線失敗 / API connection failed'
      message.error(error)
      addLog('error', error)
    } finally {
      setTesting(false)
    }
  }

  const handleExportShareString = async () => {
    const values = await form.validateFields()
    const encoded = encodeSettingsShare(values)
    try {
      await navigator.clipboard.writeText(encoded)
      message.success('已複製配置字串至剪貼板 / Copied settings string')
    } catch {
      message.warning('複製失敗，請手動複製下方字串 / Copy failed — copy the string manually')
    }
    setSharePaste(encoded)
  }

  const handleImportFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const parsed = decodeSettingsShare(text)
      form.setFieldsValue(parsed)
      updateSettings(parsed)
      message.success('已從剪貼板匯入並儲存 / Imported from clipboard and saved')
    } catch (e) {
      message.error(
        e instanceof Error ? e.message : '剪貼板匯入失敗 / Clipboard import failed',
      )
    }
  }

  const handleApplyPastedString = () => {
    try {
      const parsed = decodeSettingsShare(sharePaste)
      form.setFieldsValue(parsed)
      updateSettings(parsed)
      message.success('已套用並儲存 / Applied and saved')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '解析失敗 / Parse failed')
    }
  }

  const handleQuotaCheck = async () => {
    const values = await form.validateFields()
    setCheckingQuota(true)
    setQuotaResult(null)
    addLog('info', `查詢 API Key 額度 / Checking API key quota: ${values.apiBaseUrl}`)

    try {
      const onDevLog = (detail: string) => addLog('info', '[Dev] API Log', detail)
      const result = await queryApiQuota(values, onDevLog)
      setQuotaResult(result)
      message.success(result.summary)
      addLog('success', `${result.summary}: ${result.details.join(', ')}`)
    } catch (e) {
      const error = e instanceof Error ? e.message : '額度查詢失敗 / Quota query failed'
      message.error('額度查詢失敗 / Quota query failed')
      addLog('error', error)
    } finally {
      setCheckingQuota(false)
    }
  }

  const handleDetectModels = async () => {
    const values = await form.validateFields(['apiBaseUrl', 'apiKey'])
    setDetectingModels(true)
    addLog('info', `檢測 API 支援模型 / Detecting supported models: ${values.apiBaseUrl}`)

    try {
      const onDevLog = (detail: string) => addLog('info', '[Dev] API Log', detail)
      const imageModels = await detectImageModels({ ...settings, ...values }, onDevLog)
      form.setFieldValue('imageModels', imageModels)
      updateSettings({ ...settings, ...form.getFieldsValue(), imageModels })
      if (imageModels.length === 0) {
        message.warning('未檢測到可用圖片模型')
        addLog('error', '未檢測到可用圖片模型 / No available image models detected')
      } else {
        message.success(`已檢測到 ${imageModels.length} 個圖片模型`)
        addLog('success', `模型檢測完成 / Model detection completed: ${imageModels.join(', ')}`)
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : '模型檢測失敗 / Model detection failed'
      message.error(error)
      addLog('error', error)
    } finally {
      setDetectingModels(false)
    }
  }

  const handleDetectTextModels = async () => {
    const values = await form.validateFields(
      textApiMode === 'custom'
        ? ['apiBaseUrl', 'apiKey', 'textApiBaseUrl', 'textApiKey']
        : ['apiBaseUrl', 'apiKey'],
    )
    setDetectingTextModels(true)
    const mergedSettings = { ...settings, ...form.getFieldsValue(), ...values }
    addLog('info', `檢測文字模型 / Detecting text models: ${textApiMode === 'custom' ? mergedSettings.textApiBaseUrl : mergedSettings.apiBaseUrl}`)

    try {
      const onDevLog = (detail: string) => addLog('info', '[Dev] API Log', detail)
      const textModels = await detectTextModels(mergedSettings, onDevLog)
      form.setFieldsValue({
        textModels,
        promptOptimizerModel: textModels[0] ?? mergedSettings.promptOptimizerModel,
      })
      updateSettings({
        ...mergedSettings,
        textModels,
        promptOptimizerModel: textModels[0] ?? mergedSettings.promptOptimizerModel,
      })
      if (textModels.length === 0) {
        message.warning('未檢測到可用文字模型')
        addLog('error', '未檢測到可用文字模型 / No available text models detected')
      } else {
        message.success(`已檢測到 ${textModels.length} 個文字模型`)
        addLog('success', `文字模型檢測完成 / Text model detection completed: ${textModels.join(', ')}`)
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : '文字模型檢測失敗 / Text model detection failed'
      message.error(error)
      addLog('error', error)
    } finally {
      setDetectingTextModels(false)
    }
  }

  return (
    <Drawer
      title="API 設定"
      open={open}
      onClose={onClose}
      width={isMobile ? '100%' : 560}
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>
            儲存
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        icon={<SafetyOutlined />}
        message="本地儲存"
        description="設定儲存於本地瀏覽器中，不會上傳至任何伺服器"
        style={{ marginBottom: 24 }}
      />

      <Form form={form} layout="vertical" initialValues={settings}>
        <Card
          title={
            <Space>
              <LinkOutlined />
              <span>連線設定 / Connection</span>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <Form.Item
            label="API 地址 / API Base URL"
            name="apiBaseUrl"
            rules={[{ required: true, message: '請輸入 API 地址 / Please enter API base URL' }]}
            help="預設：https://api.openai.com，支援自訂代理位址"
          >
            <Input placeholder="https://api.openai.com" />
          </Form.Item>

          <Form.Item
            label="API 金鑰 / API Key"
            name="apiKey"
            rules={[{ required: true, message: '請輸入 API Key / Please enter API Key' }]}
          >
            <Input.Password placeholder="sk-..." />
          </Form.Item>

          <Flex gap="small" wrap>
            <Button loading={testing} onClick={handleTest} block>
              測試連通性 / Test Connection
            </Button>
            <Button loading={checkingQuota} onClick={handleQuotaCheck} block>
              查詢額度 / Check Quota
            </Button>
          </Flex>

          <Divider style={{ margin: '20px 0' }} />

          <Form.Item
            label="圖片模型 / Image Models"
            name="imageModels"
            help="點擊檢測會讀取 /v1/models，並篩選圖片模型；也可以手動輸入自訂模型 ID"
          >
            <Select
              mode="tags"
              placeholder="例如：gpt-image-2"
              tokenSeparators={[',', ' ']}
              options={(settings.imageModels ?? ['gpt-image-2']).map((model) => ({ value: model, label: model }))}
            />
          </Form.Item>

          <Button loading={detectingModels} onClick={handleDetectModels} block>
            檢測 API 支援模型 / Detect Models
          </Button>
        </Card>

        <Card
          title={
            <Space>
              <LinkOutlined />
              <span>文字模型與 Prompt 優化 / Text Models</span>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <Form.Item
            label="文字 API / Text API"
            name="textApiMode"
            help="可沿用圖片 API，也可為 Prompt 優化單獨設定另一組 OpenAI 相容 API"
          >
            <Radio.Group
              options={[
                { value: 'same', label: '沿用圖片 API' },
                { value: 'custom', label: '使用獨立文字 API' },
              ]}
              optionType="button"
              buttonStyle="solid"
            />
          </Form.Item>

          {textApiMode === 'custom' && (
            <>
              <Form.Item
                label="文字 API 地址 / Text API Base URL"
                name="textApiBaseUrl"
                rules={[{ required: true, message: '請輸入文字 API 地址 / Please enter text API base URL' }]}
              >
                <Input placeholder="https://api.openai.com" />
              </Form.Item>

              <Form.Item
                label="文字 API 金鑰 / Text API Key"
                name="textApiKey"
                rules={[{ required: true, message: '請輸入文字 API Key / Please enter text API key' }]}
              >
                <Input.Password placeholder="sk-..." />
              </Form.Item>
            </>
          )}

          <Form.Item
            label="文字模型 / Text Models"
            name="textModels"
            help="用於 Prompt 優化；可檢測 /v1/models，也可手動輸入自訂模型 ID"
          >
            <Select
              mode="tags"
              placeholder="例如：gpt-4o-mini"
              tokenSeparators={[',', ' ']}
              options={(settings.textModels ?? ['gpt-4o-mini']).map((model) => ({ value: model, label: model }))}
            />
          </Form.Item>

          <Form.Item
            label="Prompt 優化模型 / Prompt Optimizer Model"
            name="promptOptimizerModel"
            rules={[{ required: true, message: '請選擇或輸入 Prompt 優化模型' }]}
          >
            <Select
              showSearch
              placeholder="選擇或輸入模型 ID"
              options={(form.getFieldValue('textModels') ?? settings.textModels ?? ['gpt-4o-mini'])
                .map((model: string) => ({ value: model, label: model }))}
            />
          </Form.Item>

          <Button loading={detectingTextModels} onClick={handleDetectTextModels} block>
            檢測文字模型 / Detect Text Models
          </Button>
        </Card>

        {quotaResult && (
          <Card
            title={
              <Space>
                <WalletOutlined />
                <span>額度資訊 / Quota Info</span>
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            <Alert
              type="success"
              showIcon
              message={`${quotaResult.summary} (${quotaResult.source})`}
              description={
                <List
                  size="small"
                  dataSource={quotaResult.details}
                  renderItem={(item) => <List.Item>{item}</List.Item>}
                />
              }
            />
          </Card>
        )}

        <Card
          title={
            <Space>
              <CopyOutlined />
              <span>配置匯出匯入 / Import & Export</span>
            </Space>
          }
        >
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="安全提醒"
            description="字串包含 API Key，請妥善保管，勿分享至公開場合"
          />

          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Flex gap="small" wrap>
              <Button icon={<CopyOutlined />} onClick={handleExportShareString}>
                匯出並複製
              </Button>
              <Button icon={<ImportOutlined />} onClick={handleImportFromClipboard}>
                從剪貼板匯入
              </Button>
            </Flex>

            <Input.TextArea
              value={sharePaste}
              onChange={(e) => setSharePaste(e.target.value)}
              placeholder="貼上配置字串後點擊套用 / Paste settings string, then apply"
              autoSize={{ minRows: 2, maxRows: 6 }}
            />

            <Button type="primary" block onClick={handleApplyPastedString}>
              套用配置 / Apply
            </Button>
          </Space>
        </Card>
      </Form>

      <Divider style={{ marginTop: 24 }} />

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        需要 OpenAI 帳號並完成{' '}
        <Typography.Link
          href="https://platform.openai.com/settings/organization/general"
          target="_blank"
        >
          API Organization Verification
        </Typography.Link>{' '}
        才能使用 gpt-image-2 模型。
      </Typography.Text>
    </Drawer>
  )
}
