# GPT Image Creator

一个基于 React + Vite + Ant Design 的图片生成与编辑工具，支持文生图、参考图编辑、历史记录和实时日志查看。

## 功能特性

- 文生图（Text to Image）
- 参考图编辑（Image Edits，可上传多张参考图）
- Prompt 与 Negative Prompt 优化
- 生成结果二次修改（基于当前结果继续迭代）
- Token 估算与用量展示
- 历史记录管理
- 实时日志面板（便于排查调用过程）
- 桌面/移动端自适应界面

## 技术栈

- React 19
- TypeScript
- Vite
- Ant Design

## 环境要求

- Node.js 18+（建议使用 LTS 版本）
- Yarn（项目当前包含 `yarn.lock`）

## 快速开始

```bash
yarn install
yarn dev
```

启动后默认访问本地 Vite 地址（通常是 `http://localhost:5173`）。

## 可用脚本

```bash
# 本地开发
yarn dev

# 生产构建（先执行 TypeScript build，再执行 Vite build）
yarn build

# 预览构建产物
yarn preview
```

## 配置说明

应用内通过“设置”面板配置 API Key 和相关模型参数。  
请勿将任何密钥写入代码仓库或公开文件。

## 部署

仓库包含 `deploy.sh` 脚本，可用于将构建产物同步到远端服务器。

建议流程：

```bash
yarn build
bash deploy.sh
```

> 使用前请先检查 `deploy.sh` 中的服务器配置、认证方式和目标目录是否正确。

## 目录结构（简要）

```text
src/
  components/   # 页面与业务组件
  context/      # 全局状态上下文
  hooks/        # 自定义 Hook
  types/        # 类型定义
  utils/        # API、存储、导出、token 估算等工具
```

## 注意事项

- 已在 `.gitignore` 中忽略：`node_modules/`、`dist/`、`.cursor/`
- 建议仅上传构建产物到生产环境
- 如遇接口调用问题，可优先查看应用内实时日志面板
