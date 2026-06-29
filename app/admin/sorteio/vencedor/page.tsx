'use client'

import { useState, useEffect } from 'react'

const BRAND = {
  yellow: '#FFD600',
  black: '#1A1A1A',
}

type WinnerResult =
  | { found: false }
  | {
      found: true
      code: string
      valid: boolean
      participant: { nickname: string; full_name: string; cpf: string }
      receipt: {
        status: string
        amount_on_receipt: number | null
        cnpj_on_receipt: string | null
        receipt_date: string | null
      }
      imageUrl: string | null
    }

export default function VencedorPage() {
  const [pageState, setPageState] = useState<'loading' | 'login' | 'authed'>('loading')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [codeInput, setCodeInput] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [result, setResult] = useState<WinnerResult | null>(null)

  async function checkAuth() {
    try {
      const res = await fetch('/api/admin/draw-snapshot?format=count')
      if (res.status === 401) {
        setPageState('login')
        return
      }
      if (!res.ok) {
        setPageState('login')
        return
      }
      setPageState('authed')
    } catch {
      setPageState('login')
    }
  }

  useEffect(() => {
    checkAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setLoginError('Senha incorreta.')
        return
      }
      setPassword('')
      await checkAuth()
    } catch {
      setLoginError('Erro de conexao.')
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleVerify(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const code = codeInput.trim().toUpperCase()
    if (!code) return

    setLookupLoading(true)
    setLookupError('')
    setResult(null)

    try {
      const res = await fetch(`/api/admin/draw-winner?code=${encodeURIComponent(code)}`)
      if (res.status === 401) {
        setPageState('login')
        return
      }
      if (!res.ok) {
        setLookupError('Erro ao verificar. Tente novamente.')
        return
      }
      const data = await res.json() as WinnerResult
      setResult(data)
    } catch {
      setLookupError('Erro ao verificar. Tente novamente.')
    } finally {
      setLookupLoading(false)
    }
  }

  const baseStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: BRAND.black,
    color: '#e0e0e0',
    fontFamily: 'system-ui, sans-serif',
    padding: '24px 16px 64px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#fff',
    fontSize: 15,
    boxSizing: 'border-box',
  }

  // ── LOADING ──────────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <main style={{ ...baseStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: BRAND.yellow, fontSize: 15 }}>Carregando...</p>
      </main>
    )
  }

  // ── LOGIN ────────────────────────────────────────────────────────────────────

  if (pageState === 'login') {
    return (
      <main style={{ ...baseStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <p style={{ color: BRAND.yellow, fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 20 }}>
            Admin — Sorteio
          </p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              autoFocus
            />
            {loginError && (
              <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0 }}>{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              style={{
                padding: '12px 0',
                borderRadius: 8,
                border: 'none',
                backgroundColor: loginLoading ? '#555' : BRAND.yellow,
                color: BRAND.black,
                fontSize: 15,
                fontWeight: 700,
                cursor: loginLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {loginLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  // ── AUTHED ───────────────────────────────────────────────────────────────────

  return (
    <main style={baseStyle}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>

        <p style={{ color: BRAND.yellow, fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 24 }}>
          Verificar vencedor
        </p>

        {/* Code lookup form */}
        <form onSubmit={handleVerify} style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
          <input
            type="text"
            placeholder="PXP-2026-XXXXX"
            value={codeInput}
            onChange={e => setCodeInput(e.target.value)}
            style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 16, letterSpacing: 1 }}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={lookupLoading || !codeInput.trim()}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: lookupLoading || !codeInput.trim() ? '#555' : BRAND.yellow,
              color: BRAND.black,
              fontSize: 15,
              fontWeight: 700,
              cursor: lookupLoading || !codeInput.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {lookupLoading ? 'Buscando...' : 'Verificar'}
          </button>
        </form>

        {/* Fetch error */}
        {lookupError && (
          <p style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 20 }}>{lookupError}</p>
        )}

        {/* Result */}
        {result !== null && (
          <>
            {!result.found ? (
              <p style={{ color: '#888', fontSize: 15 }}>
                Código não encontrado. Verifique e tente novamente.
              </p>
            ) : (
              <>
                {/* ZONE 1 — safe to show on air */}
                <div style={{
                  backgroundColor: '#242424',
                  border: '1px solid #333',
                  borderRadius: 12,
                  padding: '28px 24px',
                  marginBottom: 20,
                }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#666', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 16px' }}>
                    Resultado
                  </p>

                  {/* Code */}
                  <p style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 800, color: '#ffffff', letterSpacing: 2, margin: '0 0 16px' }}>
                    {result.code}
                  </p>

                  {/* Validity badge */}
                  {result.valid ? (
                    <div style={{
                      display: 'inline-block',
                      backgroundColor: '#1a3a1a',
                      border: '2px solid #3a8a3a',
                      borderRadius: 8,
                      padding: '10px 24px',
                      marginBottom: 16,
                    }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#6fcf6f', letterSpacing: 2 }}>
                        VÁLIDO
                      </span>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{
                        display: 'inline-block',
                        backgroundColor: '#3a1a1a',
                        border: '2px solid #8a3a3a',
                        borderRadius: 8,
                        padding: '10px 24px',
                        marginBottom: 8,
                      }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: '#cf6f6f', letterSpacing: 2 }}>
                          INVÁLIDO
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: '#999' }}>
                        Status do recibo: {result.receipt.status}
                      </p>
                    </div>
                  )}

                  {/* Nickname */}
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>
                    {result.participant.nickname}
                  </p>
                </div>

                {/* ZONE 2 — internal data, must not be shown on air */}
                <div style={{
                  backgroundColor: '#1e0a0a',
                  border: '2px solid #8a2020',
                  borderRadius: 12,
                  padding: '20px 24px',
                }}>
                  <p style={{
                    margin: '0 0 20px',
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#cf4444',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}>
                    DADOS INTERNOS — NÃO EXIBIR AO VIVO
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                    <div>
                      <span style={{ color: '#777', marginRight: 8 }}>Nome completo:</span>
                      <span style={{ color: '#e0e0e0', fontWeight: 600 }}>{result.participant.full_name}</span>
                    </div>
                    <div>
                      <span style={{ color: '#777', marginRight: 8 }}>CPF:</span>
                      <span style={{ color: '#e0e0e0', fontWeight: 600, fontFamily: 'monospace' }}>{result.participant.cpf}</span>
                    </div>

                    <div style={{ borderTop: '1px solid #3a1a1a', paddingTop: 10, marginTop: 4 }}>
                      <p style={{ color: '#777', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Recibo</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div>
                          <span style={{ color: '#777', marginRight: 8 }}>Status:</span>
                          <span style={{ color: '#e0e0e0' }}>{result.receipt.status}</span>
                        </div>
                        <div>
                          <span style={{ color: '#777', marginRight: 8 }}>Valor:</span>
                          <span style={{ color: '#e0e0e0' }}>
                            {result.receipt.amount_on_receipt !== null
                              ? `R$ ${result.receipt.amount_on_receipt.toFixed(2).replace('.', ',')}`
                              : '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#777', marginRight: 8 }}>CNPJ:</span>
                          <span style={{ color: '#e0e0e0', fontFamily: 'monospace' }}>{result.receipt.cnpj_on_receipt ?? '—'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#777', marginRight: 8 }}>Data:</span>
                          <span style={{ color: '#e0e0e0' }}>{result.receipt.receipt_date ?? '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #3a1a1a', paddingTop: 10, marginTop: 4 }}>
                      <p style={{ color: '#777', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Imagem do recibo</p>
                      {result.imageUrl ? (
                        <img
                          src={result.imageUrl}
                          alt="Recibo"
                          style={{ maxWidth: 400, width: '100%', borderRadius: 8, border: '1px solid #3a1a1a' }}
                        />
                      ) : (
                        <p style={{ color: '#555', fontSize: 14, margin: 0 }}>Imagem indisponível</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

      </div>
    </main>
  )
}
