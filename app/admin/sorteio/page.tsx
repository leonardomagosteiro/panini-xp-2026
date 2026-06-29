'use client'

import { useState, useEffect } from 'react'

const BRAND = {
  yellow: '#FFD600',
  black: '#1A1A1A',
}

export default function SorteioPage() {
  const [pageState, setPageState] = useState<'loading' | 'login' | 'authed'>('loading')
  const [total, setTotal] = useState(0)
  const [drawPhase, setDrawPhase] = useState<'announced' | 'completed'>('announced')
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [startLoading, setStartLoading] = useState(false)
  const [startError, setStartError] = useState('')

  async function fetchCount() {
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
      const data = await res.json() as { total: number; draw_phase?: string }
      setTotal(data.total)
      if (data.draw_phase === 'completed') setDrawPhase('completed')
      else setDrawPhase('announced')
      setPageState('authed')
    } catch {
      setPageState('login')
    }
  }

  useEffect(() => {
    fetchCount()
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
      await fetchCount()
    } catch {
      setLoginError('Erro de conexao.')
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleConfirmStart() {
    setStartLoading(true)
    setStartError('')
    try {
      const res = await fetch('/api/admin/draw-start', { method: 'POST' })
      if (!res.ok) {
        setStartError('Erro ao iniciar. Tente novamente.')
        return
      }
      const data = await res.json() as { draw_phase: string; started_at: string }
      setDrawPhase('completed')
      setStartedAt(data.started_at)
      setShowConfirm(false)
    } catch {
      setStartError('Erro ao iniciar. Tente novamente.')
    } finally {
      setStartLoading(false)
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

  // ── LOADING ─────────────────────────────────────────────────────────────────

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
      {/* Confirmation modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '24px 16px',
        }}>
          <div style={{
            backgroundColor: '#242424',
            border: '1px solid #444',
            borderRadius: 12,
            padding: '32px 24px',
            width: '100%',
            maxWidth: 360,
          }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', margin: '0 0 24px', textAlign: 'center' }}>
              Começar sorteio?
            </p>
            {startError && (
              <p style={{ color: '#ff6b6b', fontSize: 13, margin: '0 0 16px', textAlign: 'center' }}>{startError}</p>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setShowConfirm(false); setStartError('') }}
                disabled={startLoading}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 8,
                  border: '1px solid #555',
                  backgroundColor: 'transparent',
                  color: '#cccccc',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: startLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmStart}
                disabled={startLoading}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: startLoading ? '#555' : BRAND.yellow,
                  color: BRAND.black,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: startLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {startLoading ? 'Aguarde...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        <p style={{ color: BRAND.yellow, fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 24 }}>
          Sorteio Panini XP 2026
        </p>

        {/* Live code count */}
        <div style={{
          backgroundColor: '#242424',
          borderRadius: 12,
          padding: '32px 24px',
          marginBottom: 28,
          border: '1px solid #333',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 52, fontWeight: 800, color: '#ffffff', margin: '0 0 8px', letterSpacing: -1, lineHeight: 1 }}>
            {total.toLocaleString('pt-BR')}
          </p>
          <p style={{ fontSize: 15, color: '#888', margin: 0 }}>
            códigos gerados
          </p>
        </div>

        {/* Draw control */}
        <div style={{ marginBottom: 28 }}>
          {drawPhase === 'announced' ? (
            <button
              onClick={() => { setStartError(''); setShowConfirm(true) }}
              style={{
                display: 'block',
                width: '100%',
                padding: '18px 0',
                borderRadius: 8,
                border: 'none',
                backgroundColor: BRAND.yellow,
                color: BRAND.black,
                fontSize: 18,
                fontWeight: 800,
                cursor: 'pointer',
                letterSpacing: 0.5,
              }}
            >
              Começar sorteio
            </button>
          ) : (
            <div style={{
              backgroundColor: '#1e2a1e',
              border: '1px solid #2e4a2e',
              borderRadius: 8,
              padding: '16px 20px',
            }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#6fcf6f' }}>
                Sorteio iniciado
              </p>
              {startedAt && (
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#555' }}>
                  {new Date(startedAt).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Export buttons — three peers, identical style */}
        <div style={{ display: 'flex', gap: 12 }}>
          <a
            href="/api/admin/draw-snapshot?format=txt"
            download="codes.txt"
            style={{
              flex: 1,
              display: 'block',
              textAlign: 'center',
              padding: '12px 0',
              borderRadius: 8,
              backgroundColor: '#2e2e2e',
              border: '1px solid #444',
              color: '#cccccc',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Exportar TXT
          </a>
          <a
            href="/api/admin/draw-snapshot?format=csv"
            download="codes.csv"
            style={{
              flex: 1,
              display: 'block',
              textAlign: 'center',
              padding: '12px 0',
              borderRadius: 8,
              backgroundColor: '#2e2e2e',
              border: '1px solid #444',
              color: '#cccccc',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Exportar CSV
          </a>
          <a
            href="/api/admin/draw-snapshot?format=xlsx"
            download="codes.xlsx"
            style={{
              flex: 1,
              display: 'block',
              textAlign: 'center',
              padding: '12px 0',
              borderRadius: 8,
              backgroundColor: '#2e2e2e',
              border: '1px solid #444',
              color: '#cccccc',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Exportar XLSX
          </a>
        </div>

      </div>
    </main>
  )
}
