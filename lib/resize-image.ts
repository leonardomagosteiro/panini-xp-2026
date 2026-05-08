import imageCompression from 'browser-image-compression'

export async function resizeReceiptImage(file: File): Promise<File> {
  // Detect HEIC/HEIF by MIME type OR file extension (some browsers don't set MIME correctly)
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.(heic|heif)$/i.test(file.name)

  let workingFile = file

  if (isHeic) {
    try {
      const heic2any = (await import('heic2any')).default
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 }) as Blob
      const jpegName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
      workingFile = new File([blob], jpegName, { type: 'image/jpeg' })
    } catch (err) {
      console.error('[resize-image] underlying error:', err)
      throw new Error('Não foi possível otimizar a foto. Tente uma foto diferente.')
    }
  }

  // 2MB skip check runs after HEIC conversion
  if (workingFile.size < 2 * 1024 * 1024) {
    return workingFile
  }

  try {
    const compressed = await imageCompression(workingFile, {
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
    const retry = await imageCompression(workingFile, {
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
