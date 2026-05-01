'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'

const BRAND = {
  yellow: '#FFD600',
  red: '#CC0000',
  black: '#1A1A1A',
}

function formatCPF(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function validateCPF(value: string): boolean {
  const cpf = value.replace(/\D/g, '')
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i)
  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cpf[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i)
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  return remainder === parseInt(cpf[10])
}

type Mode = 'cpf-check' | 'photo-select' | 'success'

function EnviarReciboForm() {
  const searchParams = useSearchParams()
  const cpfParam = searchParams.get('cpf') || ''
  const isNew = searchParams.get('new') === '1'
  const isWelcome = searchParams.get('welcome') === '1'
  const nicknameParam = searchParams.get('nickname') || ''

  const [mode, setMode] = useState<Mode>('cpf-check')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [cpf, setCpf] = useState(cpfParam)
  const [cpfError, setCpfError] = useState('')

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-validate CPF from URL param on mount
  useEffect(() => {
    if (!cpfParam) return

    setLoading(true)
    fetch('/api/cpf-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: cpfParam }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data.found) {
          setError('Nao foi possivel verificar seu CPF automaticamente. Digite manualmente abaixo.')
          setCpf('')
        } else {
          setMode('photo-select')
        }
      })
      .catch(() => {
        setError('Erro de conexao. Digite seu CPF manualmente abaixo.')
        setCpf('')
      })
      .finally(() => setLoading(false))
  }, [cpfParam])

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#242424',
    borderRadius: 16,
    padding: '28px 24px',
    marginBottom: 16,
  }

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 0',
    borderRadius: 10,
    border: 'none',
    backgroundColor: loading ? '#555' : BRAND.yellow,
    color: BRAND.black,
    fontSize: 16,
    fontWeight: 700,
    cursor: loading ? 'not-allowed' : 'pointer',
    letterSpacing: 0.5,
    transition: 'opacity 0.2s',
  }

  const sectionTitle: React.CSSProperties = {
    color: BRAND.yellow,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  }

  function handleCPFBlur() {
    const clean = cpf.replace(/\D/g, '')
    if (clean.length === 0) return
    if (clean.length !== 11 || !validateCPF(cpf)) {
      setCpfError('CPF invalido. Verifique os numeros digitados.')
    } else {
      setCpfError('')
    }
  }

  async function handleCPFLookup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cleanCPF = cpf.replace(/\D/g, '')
    if (cleanCPF.length !== 11 || !validateCPF(cpf)) {
      setCpfError('CPF invalido. Verifique os numeros digitados.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/cpf-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao verificar CPF. Tente novamente.')
        return
      }

      if (!data.found) {
        setError('CPF nao encontrado. Cadastre-se primeiro em /cadastro.')
        return
      }

      setMode('photo-select')
    } catch {
      setError('Erro de conexao. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!allowedTypes.includes(file.type)) {
      setError('Formato invalido. Use JPEG, PNG ou WebP.')
      return
    }

    if (file.size > 4.5 * 1024 * 1024) {
      setError('Arquivo muito grande. Tamanho maximo: 4.5MB.')
      return
    }

    setSelectedFile(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!selectedFile) {
      setError('Selecione uma foto do recibo antes de continuar.')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('cpf', cpf || cpfParam)
      formData.append('file', selectedFile)

      const res = await fetch('/api/upload-recibo', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao enviar recibo. Tente novamente.')
        return
      }

      setMode('success')
    } catch {
      setError('Erro de conexao. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: BRAND.black,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px 64px',
      }}
    >
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <Image
          src="/Logo Panini XP.png"
          alt="Panini XP"
          width={200}
          height={80}
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>

      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* BANNER */}
        {mode !== 'success' && isNew && (
          <div
            style={{
              backgroundColor: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.4)',
              borderRadius: 12,
              padding: '14px 18px',
              marginBottom: 16,
              color: '#4ade80',
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.4,
            }}
          >
            Cadastro feito! Agora envie seu primeiro recibo.
          </div>
        )}

        {mode !== 'success' && isWelcome && nicknameParam && (
          <div
            style={{
              backgroundColor: 'rgba(255,214,0,0.08)',
              border: `1px solid rgba(255,214,0,0.35)`,
              borderRadius: 12,
              padding: '14px 18px',
              marginBottom: 16,
              color: BRAND.yellow,
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.4,
            }}
          >
            Bem-vindo de volta, {nicknameParam}! Envie seu proximo recibo.
          </div>
        )}

        {/* LOADING STATE (auto-validating CPF from URL) */}
        {loading && mode === 'cpf-check' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ color: '#aaa', fontSize: 15 }}>Verificando seu cadastro...</p>
          </div>
        )}

        {/* CPF CHECK */}
        {!loading && mode === 'cpf-check' && (
          <form onSubmit={handleCPFLookup}>
            <div style={cardStyle}>
              <p style={sectionTitle}>Enviar Recibo</p>
              <p style={{ color: '#aaa', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
                Digite seu CPF para verificarmos seu cadastro.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ color: '#ccc', fontSize: 13, fontWeight: 500 }}>
                  CPF <span style={{ color: BRAND.yellow }}>*</span>
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={e => { setCpf(formatCPF(e.target.value)); setCpfError('') }}
                  onBlur={handleCPFBlur}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  required
                  style={{
                    backgroundColor: '#2a2a2a',
                    border: `1px solid ${cpfError ? '#ff6b6b' : '#444'}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: 16,
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = cpfError ? '#ff6b6b' : BRAND.yellow)}
                  onBlurCapture={e => (e.currentTarget.style.borderColor = cpfError ? '#ff6b6b' : '#444')}
                />
                {cpfError && (
                  <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0 }}>{cpfError}</p>
                )}
              </div>
            </div>

            {error && (
              <p style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>{error}</p>
            )}

            <button type="submit" style={buttonStyle} disabled={loading}>
              Continuar
            </button>
          </form>
        )}

        {/* PHOTO SELECT */}
        {mode === 'photo-select' && (
          <form onSubmit={handleUpload}>
            <div style={cardStyle}>
              <p style={sectionTitle}>Foto do Recibo</p>
              <p style={{ color: '#aaa', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
                Tire uma foto do seu recibo de compra ou selecione da galeria. O recibo precisa estar legivel.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {!previewUrl ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%',
                    padding: '32px 16px',
                    borderRadius: 10,
                    border: '2px dashed #444',
                    backgroundColor: '#1a1a1a',
                    color: '#aaa',
                    fontSize: 15,
                    cursor: 'pointer',
                    textAlign: 'center',
                    lineHeight: 1.6,
                  }}
                >
                  Toque aqui para tirar foto ou escolher da galeria
                </button>
              ) : (
                <div>
                  <div
                    style={{
                      borderRadius: 10,
                      overflow: 'hidden',
                      marginBottom: 12,
                      border: '1px solid #444',
                    }}
                  >
                    <img
                      src={previewUrl}
                      alt="Preview do recibo"
                      style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'contain', backgroundColor: '#111' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: BRAND.yellow,
                      fontSize: 13,
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    Trocar foto
                  </button>
                </div>
              )}
            </div>

            {error && (
              <p style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>{error}</p>
            )}

            <button
              type="submit"
              style={{
                ...buttonStyle,
                backgroundColor: loading || !selectedFile ? '#555' : BRAND.yellow,
                cursor: loading || !selectedFile ? 'not-allowed' : 'pointer',
              }}
              disabled={loading || !selectedFile}
            >
              {loading ? 'Enviando...' : 'Enviar Recibo'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                onClick={() => { setError(''); setMode('cpf-check'); setCpf('') }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#777',
                  fontSize: 13,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Voltar
              </button>
            </p>
          </form>
        )}

        {/* SUCCESS */}
        {mode === 'success' && (
          <div style={cardStyle}>
            <p style={{ color: BRAND.yellow, fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
              Recibo recebido!
            </p>
            <p style={{ color: '#aaa', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
              Voce sera notificado em breve com seu codigo.
            </p>
            <button
              type="button"
              onClick={() => {
                setCpf(cpfParam)
                setSelectedFile(null)
                setPreviewUrl(null)
                setError('')
                setMode('photo-select')
              }}
              style={{
                background: 'none',
                border: '1px solid #444',
                borderRadius: 8,
                color: '#aaa',
                fontSize: 14,
                cursor: 'pointer',
                padding: '10px 16px',
              }}
            >
              Enviar outro recibo
            </button>
          </div>
        )}

      </div>
    </main>
  )
}

export default function EnviarReciboPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: '100vh',
            backgroundColor: '#1A1A1A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p style={{ color: '#FFD600', fontSize: 16 }}>Carregando...</p>
        </main>
      }
    >
      <EnviarReciboForm />
    </Suspense>
  )
}
