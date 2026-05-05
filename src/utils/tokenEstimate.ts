export const estimateTextTokens = (text: string): number => {
  if (!text) return 0
  let tokens = 0
  for (const char of text) {
    const code = char.charCodeAt(0)
    tokens += (code >= 0x4e00 && code <= 0x9fff) ? 1 : 0.25
  }
  return Math.ceil(tokens)
}

const getImageDimensions = (file: Blob): Promise<{ width: number; height: number }> => (
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to read image dimensions'))
    }

    img.src = url
  })
)

const estimateImageTokensFromDimensions = (width: number, height: number): number => {
  const tiles = Math.max(1, Math.ceil(width / 512) * Math.ceil(height / 512))
  return 85 + tiles * 170
}

export const estimateReferenceImageTokens = async (files: Blob[]): Promise<number> => {
  const tokenCounts = await Promise.all(
    files.map(async (file) => {
      try {
        const { width, height } = await getImageDimensions(file)
        return estimateImageTokensFromDimensions(width, height)
      } catch {
        return 255
      }
    }),
  )

  return tokenCounts.reduce((total, count) => total + count, 0)
}

export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl)
  return response.blob()
}
