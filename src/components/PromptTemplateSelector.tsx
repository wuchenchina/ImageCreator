import { Form, Input, Modal, Select } from 'antd'
import { useState } from 'react'
import {
  buildBusinessProfileAvatarNegativePrompt,
  buildBusinessProfileAvatarPrompt,
  buildBusinessProfileAvatarPromptV2,
  PROMPT_TEMPLATE_OPTIONS,
  type BusinessProfileAvatarFields,
  type PromptTemplateResult,
} from '../utils/promptTemplates'

interface Props {
  onApply: (result: PromptTemplateResult) => void
}

const BUSINESS_PROFILE_TEMPLATE_ID = 'business-profile-avatar-poster'
const BUSINESS_PROFILE_TEMPLATE_V2_ID = 'business-profile-avatar-poster-v2'

const DEFAULT_FIELDS: BusinessProfileAvatarFields = {
  name: '',
  role: '',
  organization: '',
  displayLanguage: 'english',
  customLanguage: '',
  notes: '',
  textAlign: 'center',
  footerStyle: 'straight',
  footerBackground: 'white',
  poseStyle: 'front',
  expressionStyle: 'preserve',
  promptLanguage: 'chinese',
}

export default function PromptTemplateSelector({ onApply }: Props) {
  const [form] = Form.useForm<BusinessProfileAvatarFields>()
  const [open, setOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>()

  // Watch reactive fields for conditional rendering
  const displayLanguage = Form.useWatch('displayLanguage', form)

  const handleSelect = (id?: string) => {
    setSelectedTemplateId(id)
    if (!id) return

    if (id === BUSINESS_PROFILE_TEMPLATE_ID || id === BUSINESS_PROFILE_TEMPLATE_V2_ID) {
      form.setFieldsValue(DEFAULT_FIELDS)
      setOpen(true)
      return
    }
  }

  const handleApply = async () => {
    const values = await form.validateFields()
    const isV2 = selectedTemplateId === BUSINESS_PROFILE_TEMPLATE_V2_ID
    onApply({
      prompt: isV2
        ? buildBusinessProfileAvatarPromptV2({ ...DEFAULT_FIELDS, ...values })
        : buildBusinessProfileAvatarPrompt({ ...DEFAULT_FIELDS, ...values }),
      negativePrompt: buildBusinessProfileAvatarNegativePrompt(),
    })
    setOpen(false)
  }

  const handleCancel = () => {
    setOpen(false)
    setSelectedTemplateId(undefined)
  }

  return (
    <>
      <Select
        allowClear
        value={selectedTemplateId}
        placeholder="選擇範本後可繼續自訂提示詞 / Select a template, then customize"
        options={PROMPT_TEMPLATE_OPTIONS}
        onChange={handleSelect}
      />

      <Modal
        title="填寫商務頭像資訊 / Business Avatar Info"
        open={open}
        okText="套用範本 / Apply"
        cancelText="取消 / Cancel"
        onOk={handleApply}
        onCancel={handleCancel}
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
      >
        <Form form={form} layout="vertical" initialValues={DEFAULT_FIELDS}>
          <Form.Item
            label="姓名 / Name"
            name="name"
            tooltip="留空時會保留 [姓名] 占位，方便之後手動修改"
          >
            <Input placeholder="例如：張三 / Alex Chen" />
          </Form.Item>

          <Form.Item label="身份/職位 / Role or Title" name="role">
            <Input placeholder="例如：Founder, Professor, Product Manager；留空則不顯示" />
          </Form.Item>

          <Form.Item label="專業/部門/機構 / Department or Organization" name="organization">
            <Input placeholder="例如：Computer Science, University of Auckland；留空則不顯示" />
          </Form.Item>

          <Form.Item
            label="圖片文字語言 / Display Language"
            name="displayLanguage"
            tooltip="控制最終圖片裡顯示的文字使用什麼語言"
          >
            <Select
              options={[
                { value: 'english', label: '英文 / English' },
                { value: 'chinese', label: '中文 / Chinese' },
                { value: 'input', label: '按輸入語言 / Follow input language' },
                { value: 'custom', label: '其他語言 / Custom language' },
              ]}
            />
          </Form.Item>

          {displayLanguage === 'custom' && (
            <Form.Item
              label="指定語言 / Custom Language"
              name="customLanguage"
              rules={[{ required: true, message: '請輸入要顯示的語言 / Please enter a language' }]}
            >
              <Input placeholder="例如：Japanese, Korean, French, Māori" />
            </Form.Item>
          )}

          <Form.Item
            label="備註 / Notes"
            name="notes"
            tooltip="作為生成要求使用，不會直接作為海報文字顯示（除非備註裡明確要求）"
          >
            <Input.TextArea
              placeholder="可選：例如榮譽、郵箱、網站、研究方向，留空則不顯示備註"
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </Form.Item>

          <Form.Item label="文字對齊 / Text Alignment" name="textAlign">
            <Select
              options={[
                { value: 'center', label: '居中 / Center' },
                { value: 'left', label: '居左 / Left' },
                { value: 'right', label: '居右 / Right' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="底部資訊欄樣式 / Footer Style"
            name="footerStyle"
            tooltip="建議使用平直規整，避免波浪或曲線遮擋人物下半身"
          >
            <Select
              options={[
                { value: 'straight', label: '平直規整 / Straight and clean' },
                { value: 'decorative', label: '輕微裝飾 / Subtle decorative' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="底部背景顏色 / Footer Background"
            name="footerBackground"
            tooltip="可選擇與整體白底一致，或使用很淺的灰白色區分文字區域"
          >
            <Select
              options={[
                { value: 'white', label: '與圖片背景一致 / Match image background' },
                { value: 'lightGray', label: '淺灰白文字區域 / Light gray footer' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="人物姿態 / Portrait Pose"
            name="poseStyle"
            tooltip="可選擇類似 Apple 官網人物頭像的輕微側身效果"
          >
            <Select
              options={[
                { value: 'front', label: '正面端正 / Front-facing' },
                { value: 'slightTurn', label: '微微側身 / Slight body turn' },
              ]}
            />
          </Form.Item>

          {selectedTemplateId === BUSINESS_PROFILE_TEMPLATE_V2_ID && (
            <Form.Item
              label="面部表情 / Facial Expression"
              name="expressionStyle"
              tooltip="如果參考照片表情僵硬或缺少神韻，可選擇適當優化，但仍會要求保留身份特徵"
            >
              <Select
                options={[
                  { value: 'preserve', label: '保持原表情 / Preserve original expression' },
                  { value: 'gentleRefine', label: '適當優化表情 / Gently refine expression' },
                ]}
              />
            </Form.Item>
          )}

          <Form.Item
            label="提示詞語言 / Prompt Language"
            name="promptLanguage"
            tooltip="控制生成到提示詞輸入框裡的說明語言，不影響圖片文字顯示語言"
          >
            <Select
              options={[
                { value: 'chinese', label: '中文提示詞 / Chinese prompt' },
                { value: 'english', label: '英文提示詞 / English prompt' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
