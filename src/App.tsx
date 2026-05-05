import { useState } from 'react'
import { ConfigProvider, Layout, Menu, Button, theme, Typography, Flex, Divider, Grid } from 'antd'
import {
  PictureOutlined,
  EditOutlined,
  HistoryOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { AppProvider } from './context/AppContext'
import SettingsDrawer from './components/SettingsDrawer'
import GeneratePage from './components/GeneratePage'
import EditPage from './components/EditPage'
import HistoryPage from './components/HistoryPage'
import RealtimeLogPanel from './components/RealtimeLogPanel'

const { Header, Content } = Layout
const { useBreakpoint } = Grid

type TabKey = 'generate' | 'edit' | 'history'

const menuItems = [
  { key: 'generate', icon: <PictureOutlined />, label: '文生圖' },
  { key: 'edit', icon: <EditOutlined />, label: '圖片編輯' },
  { key: 'history', icon: <HistoryOutlined />, label: '歷史記錄' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('generate')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const screens = useBreakpoint()
  const isMobile = !screens.md

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        components: {
          Layout: { headerBg: '#ffffff', bodyBg: '#ffffff', headerHeight: 56 },
        },
      }}
    >
      <AppProvider>
        <Layout style={{ minHeight: '100vh' }}>
          <Header style={{ padding: isMobile ? '0 12px' : '0 24px', position: 'sticky', top: 0, zIndex: 100 }}>
            <Flex align="center" gap={isMobile ? 'small' : 'large'} style={{ height: '100%' }}>
              <Typography.Text strong style={{ whiteSpace: 'nowrap', fontSize: isMobile ? 14 : 16 }}>
                GPT Image Creator
              </Typography.Text>
              {!isMobile && (
                <Menu
                  mode="horizontal"
                  selectedKeys={[activeTab]}
                  items={menuItems}
                  onClick={({ key }) => setActiveTab(key as TabKey)}
                  style={{ flex: 1, borderBottom: 'none' }}
                />
              )}
              <div style={{ marginLeft: 'auto' }}>
                <Button
                  icon={<SettingOutlined />}
                  type="text"
                  onClick={() => setSettingsOpen(true)}
                >
                  {!isMobile && '設定'}
                </Button>
              </div>
            </Flex>
          </Header>

          <Content style={{
            padding: isMobile ? '12px 12px 80px' : 24,
            width: '100%',
            boxSizing: 'border-box',
          }}>
            {activeTab === 'generate' && <GeneratePage />}
            {activeTab === 'edit' && <EditPage />}
            {activeTab === 'history' && <HistoryPage />}
            <Divider />
            <RealtimeLogPanel />
          </Content>
        </Layout>

        {isMobile && (
          <nav style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            background: '#fff',
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}>
            {menuItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key as TabKey)}
                style={{
                  flex: 1,
                  padding: '8px 0 10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  color: activeTab === item.key ? '#1677ff' : '#8c8c8c',
                  fontSize: 11,
                }}
              >
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        )}

        <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </AppProvider>
    </ConfigProvider>
  )
}
