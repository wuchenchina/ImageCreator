import type { GenerateParams, EditParams } from '../types'

export const SIZE_OPTIONS = [
  { value: 'auto', label: '自动 / Auto' },
  { value: '1024x1024', label: '1024x1024（方形 / Square）' },
  { value: '1536x1024', label: '1536x1024（横向 / Landscape）' },
  { value: '1024x1536', label: '1024x1536（纵向 / Portrait）' },
  { value: '2048x2048', label: '2048x2048（2K 方形 / 2K Square）' },
  { value: '2048x1152', label: '2048x1152（2K 横向 / 2K Landscape）' },
  { value: '3840x2160', label: '3840x2160（4K 横向 / 4K Landscape）' },
  { value: '2160x3840', label: '2160x3840（4K 纵向 / 4K Portrait）' },
  { value: 'custom', label: '自定义尺寸 / Custom Size' },
]

export const QUALITY_OPTIONS = [
  { value: 'auto', label: '自动 / Auto' },
  { value: 'low', label: '低 / Low（快速 / Fast）' },
  { value: 'medium', label: '中 / Medium' },
  { value: 'high', label: '高 / High（精细 / Detailed）' },
]

export const FORMAT_OPTIONS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG（更快 / Faster）' },
  { value: 'webp', label: 'WebP' },
]

type ParamsWithSize = GenerateParams | EditParams

export const getImageSize = (params: ParamsWithSize): string => {
  if (params.size !== 'custom') return params.size
  return `${params.custom_width}x${params.custom_height}`
}

export const validateCustomSize = (width?: number, height?: number): string | null => {
  if (!width || !height) return '请输入宽度和高度'
  if (width > 3840 || height > 3840) return '最大边长不能超过 3840px'
  if (width % 16 !== 0 || height % 16 !== 0) return '宽高都必须是 16 的倍数'

  const longEdge = Math.max(width, height)
  const shortEdge = Math.min(width, height)
  if (longEdge / shortEdge > 3) return '长边与短边比例不能超过 3:1'

  const pixels = width * height
  if (pixels < 655_360) return '总像素不能低于 655,360'
  if (pixels > 8_294_400) return '总像素不能超过 8,294,400'

  return null
}
