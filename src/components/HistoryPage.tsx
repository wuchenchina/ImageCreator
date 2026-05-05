import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Row,
  Col,
  Card,
  Image,
  Typography,
  Tag,
  Button,
  Popconfirm,
  Empty,
  Space,
  Spin,
  Tooltip,
  message,
  Badge,
  Flex,
  Progress,
  Grid,
} from 'antd'

const { useBreakpoint } = Grid
import {
  DeleteOutlined,
  DownloadOutlined,
  ClearOutlined,
  PictureOutlined,
  EditOutlined,
  ExportOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import { useAppContext } from '../context/AppContext'
import { dbGetImages } from '../utils/db'
import type { HistoryItem } from '../types'
import { exportLocalData, importLocalData } from '../utils/dataExport'

const { Text, Paragraph } = Typography

interface HistoryCardProps {
  item: HistoryItem
  onDelete: (id: string) => void
}

function HistoryCard({ item, onDelete }: HistoryCardProps) {
  const [images, setImages] = useState<string[] | null>(null)
  const [loadingImages, setLoadingImages] = useState(true)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)

  useEffect(() => {
    dbGetImages(item.id)
      .then((imgs) => setImages(imgs))
      .catch(() => setImages(null))
      .finally(() => setLoadingImages(false))
  }, [item.id])

  const handleDownload = (dataUrl: string, idx: number) => {
    const ext = dataUrl.includes('image/jpeg') ? 'jpg' : dataUrl.includes('image/webp') ? 'webp' : 'png'
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `image-${item.id}-${idx + 1}.${ext}`
    link.click()
  }

  const handleDownloadAll = () => {
    if (!images) return
    images.forEach((url, i) => handleDownload(url, i))
  }

  const firstImage = images?.[0]
  const hasMultiple = (images?.length ?? 0) > 1

  const cover = loadingImages ? (
    <Spin />
  ) : firstImage && images ? (
    <Image.PreviewGroup
      items={images}
      preview={{
        visible: previewVisible,
        current: previewIndex,
        onVisibleChange: setPreviewVisible,
      }}
    >
      <Image
        src={firstImage}
        alt={item.prompt}
        preview={false}
        onClick={() => {
          setPreviewIndex(0)
          setPreviewVisible(true)
        }}
      />
    </Image.PreviewGroup>
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="圖片已失效" />
  )

  return (
    <Card
      cover={
        hasMultiple ? (
          <Badge.Ribbon text={`+${(images?.length ?? 1) - 1}`}>
            {cover}
          </Badge.Ribbon>
        ) : cover
      }
    >
      <Space direction="vertical">
        <Space>
          <Tag
            icon={item.type === 'generate' ? <PictureOutlined /> : <EditOutlined />}
            color={item.type === 'generate' ? 'blue' : 'purple'}
          >
            {item.type === 'generate' ? '文生圖' : '圖片編輯'}
          </Tag>
          <Text type="secondary">
            {new Date(item.createdAt).toLocaleString('zh-CN')}
          </Text>
        </Space>

        <Paragraph ellipsis={{ rows: 2, tooltip: item.prompt }}>
          {item.prompt}
        </Paragraph>

        <Space wrap>
          <Tag>{item.model}</Tag>
          <Tag>{item.size}</Tag>
          <Tag>{item.quality}</Tag>
          {item.count > 1 && <Tag>{item.count} 張</Tag>}
        </Space>

        <Row gutter={8}>
          <Col flex={1}>
            <Tooltip title="下載全部">
              <Button
                icon={<DownloadOutlined />}
                size="small"
                block
                disabled={!images?.length}
                onClick={handleDownloadAll}
              >
                下載
              </Button>
            </Tooltip>
          </Col>
          <Col>
            <Popconfirm
              title="確認刪除此筆記錄？"
              description="圖片資料將一併清除"
              onConfirm={() => onDelete(item.id)}
              okText="刪除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          </Col>
        </Row>
      </Space>
    </Card>
  )
}

export default function HistoryPage() {
  const { history, removeHistory, clearHistory, reloadHistory, reloadLogs, logs } = useAppContext()
  const [exporting, setExporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const screens = useBreakpoint()
  const isMobile = !screens.sm

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await removeHistory(id)
        message.success('已刪除')
      } catch {
        message.error('刪除失敗')
      }
    },
    [removeHistory],
  )

  const handleClearAll = async () => {
    try {
      await clearHistory()
      message.success('歷史記錄已清空')
    } catch {
      message.error('清空失敗')
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportLocalData()
      message.success('資料匯出成功 / Export successful')
    } catch {
      message.error('匯出失敗 / Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    try {
      const result = await importLocalData(file, (current, total) => {
        setImportProgress({ current, total })
      })
      reloadHistory()
      if (result.logsRestored) {
        reloadLogs()
      }
      message.success(
        `匯入完成 / Import done — 新增 ${result.imported} 筆，跳過重複 ${result.skipped} 筆${
          result.logsRestored ? '，已恢復即時日誌 / logs restored' : ''
        }`,
      )
    } catch (err) {
      message.error(`匯入失敗 / Import failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImportProgress(null)
    }
  }

  const toolbar = (
    <Flex
      justify="space-between"
      align={isMobile ? 'flex-start' : 'center'}
      vertical={isMobile}
      gap={isMobile ? 8 : 0}
      style={{ marginBottom: 16 }}
    >
      <Typography.Text type="secondary">{history.length} 筆記錄 / records</Typography.Text>
      <Space wrap>
        <Button
          icon={<ImportOutlined />}
          onClick={() => fileInputRef.current?.click()}
          loading={importProgress !== null}
          size={isMobile ? 'small' : 'middle'}
        >
          匯入備份 / Import
        </Button>
        <Button
          icon={<ExportOutlined />}
          onClick={handleExport}
          loading={exporting}
          disabled={history.length === 0 && logs.length === 0}
          size={isMobile ? 'small' : 'middle'}
        >
          匯出全部 / Export
        </Button>
        <Popconfirm
          title="確認清空所有歷史記錄？"
          description="所有生成的圖片資料將被永久刪除"
          onConfirm={handleClearAll}
          okText="清空"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button icon={<ClearOutlined />} danger disabled={history.length === 0} size={isMobile ? 'small' : 'middle'}>
            清空歷史 / Clear
          </Button>
        </Popconfirm>
      </Space>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
    </Flex>
  )

  if (history.length === 0) {
    return (
      <>
        {toolbar}
        {importProgress && (
          <Progress
            percent={Math.round((importProgress.current / importProgress.total) * 100)}
            style={{ marginBottom: 16 }}
          />
        )}
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暫無歷史記錄，生成或編輯圖片後將在此顯示 / No history yet"
        />
      </>
    )
  }

  return (
    <div>
      {toolbar}
      {importProgress && (
        <Progress
          percent={Math.round((importProgress.current / importProgress.total) * 100)}
          style={{ marginBottom: 16 }}
        />
      )}
      <Row gutter={[16, 16]}>
        {history.map((item) => (
          <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
            <HistoryCard item={item} onDelete={handleDelete} />
          </Col>
        ))}
      </Row>
    </div>
  )
}
