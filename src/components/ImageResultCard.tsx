import { Card, Button, Tooltip, Image } from 'antd'
import { DownloadOutlined, CopyOutlined } from '@ant-design/icons'
import { message } from 'antd'

interface Props {
  dataUrl: string
  index: number
  format?: string
}

export default function ImageResultCard({ dataUrl, index, format = 'png' }: Props) {
  const handleDownload = () => {
    try {
      // Convert base64 data URL to Blob for better mobile browser compatibility
      const arr = dataUrl.split(',')
      const mimeMatch = arr[0].match(/:(.*?);/)
      const mime = mimeMatch ? mimeMatch[1] : `image/${format}`
      const bstr = atob(arr[1])
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) u8arr[n] = bstr.charCodeAt(n)
      const blob = new Blob([u8arr], { type: mime })
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `generated-${Date.now()}-${index + 1}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch {
      // Fallback: open in new tab if download fails (e.g. iOS Safari)
      const win = window.open()
      if (win) {
        win.document.write(`<img src="${dataUrl}" style="max-width:100%">`)
      }
    }
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(dataUrl)
      message.success('已複製 Base64 資料')
    } catch {
      message.error('複製失敗')
    }
  }

  return (
    <Card
      hoverable
      cover={
        <Image
          src={dataUrl}
          alt={`Generated image ${index + 1}`}
          width="100%"
          preview={{ src: dataUrl }}
        />
      }
      actions={[
        <Tooltip title="下載" key="download">
          <Button type="text" icon={<DownloadOutlined />} onClick={handleDownload} />
        </Tooltip>,
        <Tooltip title="複製 Base64" key="copy">
          <Button type="text" icon={<CopyOutlined />} onClick={handleCopyUrl} />
        </Tooltip>,
      ]}
    />
  )
}
