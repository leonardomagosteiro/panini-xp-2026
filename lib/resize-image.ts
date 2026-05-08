import imageCompression from 'browser-image-compression'

export async function resizeReceiptImage(file: File): Promise<File> {
  if (file.size < 2 * 1024 * 1024) {
    return file
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 4,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.85,
    })

    if (compressed.size <= 4 * 1024 * 1024) {
      return compressed
    }

    // File still over 4MB — retry at lower quality
    const retry = await imageCompression(file, {
      maxSizeMB: 4,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.7,
    })

    if (retry.size <= 4 * 1024 * 1024) {
      return retry
    }

    throw new Error('Não foi possível otimizar a foto. Tente uma foto diferente.')
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Não foi possível')) {
      throw err
    }
    console.error('[resize-image] underlying error:', err)
    throw new Error('Não foi possível otimizar a foto. Tente uma foto diferente.')
  }
}
