import { useEffect, useRef, useState } from 'react'
import { Button, Card, Collapse, Empty, List, Space, Tag, Typography, Statistic, Row, Col } from 'antd'
import { ClearOutlined } from '@ant-design/icons'
import { useAppContext } from '../context/AppContext'

const levelColor = {
  info: 'processing',
  success: 'success',
  error: 'error',
} as const

const levelLabel = {
  info: '資訊 / Info',
  success: '成功 / Success',
  error: '錯誤 / Error',
} as const

export default function RealtimeLogPanel() {
  const { logs, clearLogs, sessionStats } = useAppContext()
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])

  const prevLogsLen = useRef(0)
  useEffect(() => {
    if (logs.length <= prevLogsLen.current) {
      prevLogsLen.current = logs.length
      return
    }
    prevLogsLen.current = logs.length
    const newest = logs.find((l) => l.detail)
    if (newest) {
      setExpandedKeys((prev) => (prev.includes(newest.id) ? prev : [newest.id, ...prev]))
    }
  }, [logs])

  const hasStats = sessionStats.imagesGenerated > 0

  return (
    <Card
      title="即時日誌 / Realtime Logs"
      extra={
        <Button icon={<ClearOutlined />} onClick={clearLogs} disabled={logs.length === 0}>
          清空 / Clear
        </Button>
      }
    >
      {hasStats && (
        <Row gutter={16} style={{ marginBottom: 16, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
          <Col>
            <Statistic title="本次已生成圖片" value={sessionStats.imagesGenerated} suffix="張" valueStyle={{ fontSize: 16 }} />
          </Col>
          {sessionStats.inputTokens > 0 && (
            <Col>
              <Statistic title="累計輸入 Token" value={sessionStats.inputTokens} valueStyle={{ fontSize: 16 }} />
            </Col>
          )}
          {sessionStats.outputTokens > 0 && (
            <Col>
              <Statistic title="累計輸出 Token" value={sessionStats.outputTokens} valueStyle={{ fontSize: 16 }} />
            </Col>
          )}
          {(sessionStats.inputTokens + sessionStats.outputTokens) > 0 && (
            <Col>
              <Statistic
                title="累計總 Token"
                value={sessionStats.inputTokens + sessionStats.outputTokens}
                valueStyle={{ fontSize: 16, color: '#1677ff' }}
              />
            </Col>
          )}
        </Row>
      )}

      {logs.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暫無日誌 / No logs yet" />
      ) : (
        <List
          size="small"
          dataSource={logs}
          renderItem={(item) => (
            <List.Item style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <Space>
                <Tag color={levelColor[item.level]}>{levelLabel[item.level]}</Tag>
                <Typography.Text type="secondary">
                  {new Date(item.time).toLocaleTimeString()}
                </Typography.Text>
                <Typography.Text>{item.message}</Typography.Text>
              </Space>
              {item.detail && (
                <Collapse
                  ghost
                  size="small"
                  activeKey={expandedKeys.includes(item.id) ? [item.id] : []}
                  onChange={(keys) => {
                    const active = Array.isArray(keys) ? keys.map(String) : [String(keys)]
                    setExpandedKeys((prev) => {
                      const without = prev.filter((k) => k !== item.id)
                      return active.length > 0 ? [...without, item.id] : without
                    })
                  }}
                  style={{ width: '100%', marginTop: 4 }}
                  items={[
                    {
                      key: item.id,
                      label: <Typography.Text type="secondary" style={{ fontSize: 12 }}>查看原始資料 / Raw data</Typography.Text>,
                      children: (
                        <pre
                          style={{
                            background: '#1a1a1a',
                            color: '#e8e8e8',
                            padding: 12,
                            borderRadius: 6,
                            fontSize: 12,
                            overflowX: 'auto',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                          }}
                        >
                          {item.detail}
                        </pre>
                      ),
                    },
                  ]}
                />
              )}
            </List.Item>
          )}
        />
      )}
    </Card>
  )
}
