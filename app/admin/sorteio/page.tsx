'use client'

import { useState, useEffect } from 'react'

const BRAND = {
  yellow: '#FFD600',
  black: '#1A1A1A',
}

export default function SorteioPage() {
  const [pageState, setPageState] = useState<'loading' | 'login' | 'authed'>('loading')
  const [total, setTotal] = useState(0)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

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
      const data = await res.json() as { total: number }
      setTotal(data.total)
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

        {/* Download buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>

          {/* TXT — primary, visually emphasized */}
          <a
            href="/api/admin/draw-snapshot?format=txt"
            download="codes.txt"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '16px 0',
              borderRadius: 8,
              backgroundColor: BRAND.yellow,
              color: BRAND.black,
              fontSize: 16,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Baixar TXT (para o sorteio)
          </a>

          {/* CSV + XLSX — secondary, side by side */}
          <div style={{ display: 'flex', gap: 12 }}>
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
              Baixar CSV
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
              Baixar XLSX
            </a>
          </div>
        </div>

        <p style={{ color: '#666', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          O arquivo TXT é o que será usado na ferramenta de sorteio. CSV e XLSX são para registro.
        </p>

      </div>
    </main>
  )
}
