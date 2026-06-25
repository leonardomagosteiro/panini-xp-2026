'use client'

import { useState, useEffect } from 'react'
const REJECTION_REASON_VALUES = [
  'not_a_receipt',
  'invalid_cnpj',
  'amount_too_low',
  'date_out_of_window',
  'duplicate',
  'unreadable',
] as const

type AdminRejectionReason = typeof REJECTION_REASON_VALUES[number]

const BRAND = {
  yellow: '#FFD600',
  red: '#CC0000',
  black: '#1A1A1A',
}

type SystemNote = 'no_email_on_file' | 'image_too_large' | 'image_unprocessable'

type AiRawResponse = {
  _system_note?: SystemNote
  cnpj?: string | null
  amount_total_brl?: number | null
  receipt_date?: string | null
  confidence?: string | null
  notes?: string | null
  is_receipt?: boolean | null
  is_readable?: boolean | null
}

type Participant = {
  nickname: string
  email: string | null
  whatsapp: string
  full_name: string
}

type ReceiptRow = {
  id: string
  storage_path: string
  created_at: string
  ai_raw_response: AiRawResponse | null
  ai_confidence: string | null
  cnpj_on_receipt: string | null
  receipt_date: string | null
  amount_on_receipt: number | null
  signed_image_url: string | null
  participants: Participant
}

type ActiveAction =
  | { receiptId: string; type: 'approve' }
  | { receiptId: string; type: 'reject' }
  | { receiptId: string; type: 'reprocess' }

const REJECTION_LABELS: Record<AdminRejectionReason, string> = {
  not_a_receipt: 'Nao e um recibo',
  invalid_cnpj: 'CNPJ invalido / loja nao participante',
  amount_too_low: 'Valor abaixo de R$50',
  date_out_of_window: 'Data fora do periodo da campanha',
  duplicate: 'Recibo duplicado',
  unreadable: 'Imagem ilegivel',
}

const REJECTION_REASONS = REJECTION_REASON_VALUES as readonly AdminRejectionReason[]

function formatBrDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function SystemNoteTag({ note }: { note: SystemNote }) {
  const labels: Record<SystemNote, string> = {
    no_email_on_file: 'Sem e-mail cadastrado',
    image_too_large: 'Imagem muito grande para a IA',
    image_unprocessable: 'Imagem nao processavel pela IA',
  }
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: 'rgba(204,0,0,0.18)',
        color: '#ff8080',
        fontSize: 12,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 4,
        border: '1px solid rgba(204,0,0,0.4)',
      }}
    >
      {labels[note]}
    </span>
  )
}

function AiDataBlock({ ai }: { ai: AiRawResponse }) {
  return (
    <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.8 }}>
      {ai.cnpj != null && <div>CNPJ: <span style={{ color: '#ddd' }}>{ai.cnpj}</span></div>}
      {ai.amount_total_brl != null && (
        <div>Valor: <span style={{ color: '#ddd' }}>R$ {ai.amount_total_brl.toFixed(2)}</span></div>
      )}
      {ai.receipt_date != null && <div>Data: <span style={{ color: '#ddd' }}>{ai.receipt_date}</span></div>}
      {ai.confidence != null && <div>Confianca IA: <span style={{ color: '#ddd' }}>{ai.confidence}</span></div>}
      {ai.notes != null && <div>Notas: <span style={{ color: '#ddd' }}>{ai.notes}</span></div>}
    </div>
  )
}

export default function AdminRevisaoPage() {
  const [pageState, setPageState] = useState<'loading' | 'login' | 'authed'>('loading')
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [fetchError, setFetchError] = useState('')

  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null)
  const [approveCount, setApproveCount] = useState('1')
  const [rejectReason, setRejectReason] = useState<AdminRejectionReason | ''>('')
  const [reprocessEmail, setReprocessEmail] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  async function fetchReceipts() {
    setFetchError('')
    try {
      const res = await fetch('/api/admin/receipts-needs-review')
      if (res.status === 401) {
        setPageState('login')
        return
      }
      if (!res.ok) {
        setFetchError('Erro ao carregar recibos.')
        setPageState('authed')
        return
      }
      const data = await res.json() as ReceiptRow[]
      setReceipts(data)
      setPageState('authed')
    } catch {
      setFetchError('Erro de conexao.')
      setPageState('authed')
    }
  }

  useEffect(() => {
    fetchReceipts()
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
      await fetchReceipts()
    } catch {
      setLoginError('Erro de conexao.')
    } finally {
      setLoginLoading(false)
    }
  }

  function openAction(receiptId: string, type: ActiveAction['type']) {
    setActionError('')
    const receipt = receipts.find(r => r.id === receiptId)
    const amount = receipt?.amount_on_receipt
    const suggestedCount = (type === 'approve' && typeof amount === 'number' && amount >= 50)
      ? String(Math.floor(amount / 50))
      : '1'
    setApproveCount(suggestedCount)
    setRejectReason('')
    setReprocessEmail('')
    setActiveAction({ receiptId, type } as ActiveAction)
  }

  function closeAction() {
    setActiveAction(null)
    setActionError('')
  }

  async function handleApprove(receiptId: string) {
    const count = parseInt(approveCount, 10)
    if (!Number.isInteger(count) || count < 1) {
      setActionError('Informe um numero valido de codigos.')
      return
    }
    setActionLoading(true)
    setActionError('')
    try {
      const res = await fetch(`/api/admin/receipts/${receiptId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes_count: count }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; codes?: string[] }
      if (!res.ok) {
        setActionError(data.error ?? 'Erro ao aprovar.')
        return
      }
      setReceipts(prev => prev.filter(r => r.id !== receiptId))
      setActiveAction(null)
    } catch {
      setActionError('Erro de conexao.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject(receiptId: string) {
    if (!rejectReason) {
      setActionError('Selecione um motivo.')
      return
    }
    setActionLoading(true)
    setActionError('')
    try {
      const res = await fetch(`/api/admin/receipts/${receiptId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setActionError(data.error ?? 'Erro ao rejeitar.')
        return
      }
      setReceipts(prev => prev.filter(r => r.id !== receiptId))
      setActiveAction(null)
    } catch {
      setActionError('Erro de conexao.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReprocess(receiptId: string) {
    if (!reprocessEmail.includes('@') || !reprocessEmail.includes('.')) {
      setActionError('Informe um e-mail valido.')
      return
    }
    setActionLoading(true)
    setActionError('')
    try {
      const res = await fetch(`/api/admin/receipts/${receiptId}/add-email-and-reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: reprocessEmail }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setActionError(data.error ?? 'Erro ao reprocessar.')
        return
      }
      setReceipts(prev => prev.filter(r => r.id !== receiptId))
      setActiveAction(null)
    } catch {
      setActionError('Erro de conexao.')
    } finally {
      setActionLoading(false)
    }
  }

  const baseStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: BRAND.black,
    color: '#e0e0e0',
    fontFamily: 'system-ui, sans-serif',
    padding: '24px 16px 64px',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#242424',
    borderRadius: 12,
    padding: '20px 18px',
    marginBottom: 16,
    border: '1px solid #333',
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

  const btnStyle = (variant: 'yellow' | 'red' | 'gray'): React.CSSProperties => ({
    padding: '9px 14px',
    borderRadius: 8,
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: actionLoading ? 'not-allowed' : 'pointer',
    backgroundColor:
      variant === 'yellow' ? BRAND.yellow
      : variant === 'red' ? BRAND.red
      : '#444',
    color: variant === 'yellow' ? BRAND.black : '#fff',
    opacity: actionLoading ? 0.6 : 1,
  })

  // ── LOGIN SCREEN ────────────────────────────────────────────────────────────

  if (pageState === 'login') {
    return (
      <main style={{ ...baseStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <p style={{ color: BRAND.yellow, fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 20 }}>
            Admin — Revisao de Recibos
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

  // ── LOADING ─────────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <main style={{ ...baseStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: BRAND.yellow, fontSize: 15 }}>Carregando...</p>
      </main>
    )
  }

  // ── AUTHED — RECEIPT LIST ───────────────────────────────────────────────────

  return (
    <main style={baseStyle}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
          <p style={{ color: BRAND.yellow, fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>
            Revisao de Recibos
          </p>
          <span style={{ color: '#666', fontSize: 13 }}>
            {receipts.length} pendente{receipts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {fetchError && (
          <p style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 16 }}>{fetchError}</p>
        )}

        {receipts.length === 0 && !fetchError && (
          <div style={cardStyle}>
            <p style={{ color: '#666', fontSize: 15, margin: 0, textAlign: 'center' }}>
              Nenhum recibo aguardando revisao.
            </p>
          </div>
        )}

        {receipts.map(receipt => {
          const p = receipt.participants
          const ai = receipt.ai_raw_response
          const systemNote = ai?._system_note
          const isActive = activeAction?.receiptId === receipt.id

          return (
            <div key={receipt.id} style={cardStyle}>

              {/* ── Participant info ── */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ color: BRAND.yellow, fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>
                  {p.nickname}
                </p>
                <p style={{ color: '#888', fontSize: 12, margin: '0 0 2px' }}>
                  {p.full_name}
                </p>
                <p style={{ color: '#999', fontSize: 12, margin: '0 0 2px' }}>
                  {p.email ?? <span style={{ color: '#666' }}>sem e-mail</span>}
                </p>
                <p style={{ color: '#999', fontSize: 12, margin: 0 }}>
                  {p.whatsapp}
                </p>
              </div>

              {/* ── Image ── */}
              {receipt.signed_image_url ? (
                <div style={{ marginBottom: 14 }}>
                  <a href={receipt.signed_image_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={receipt.signed_image_url}
                      alt="Recibo"
                      style={{
                        width: '100%',
                        maxHeight: 800,
                        objectFit: 'contain',
                        borderRadius: 6,
                        border: '1px solid #333',
                        display: 'block',
                      }}
                    />
                    <span style={{ color: BRAND.yellow, fontSize: 12, marginTop: 4, display: 'block' }}>
                      Abrir imagem completa
                    </span>
                  </a>
                </div>
              ) : (
                <p style={{ color: '#555', fontSize: 12, marginBottom: 14 }}>Imagem indisponivel</p>
              )}

              {/* ── AI / system note ── */}
              <div style={{ marginBottom: 14 }}>
                {systemNote ? (
                  <SystemNoteTag note={systemNote} />
                ) : ai ? (
                  <AiDataBlock ai={ai} />
                ) : (
                  <span style={{ color: '#555', fontSize: 12 }}>Sem dados de IA</span>
                )}
              </div>

              {/* ── Textract extraction summary ── */}
              {(receipt.amount_on_receipt !== null || receipt.cnpj_on_receipt !== null || receipt.receipt_date !== null) && (
                <div style={{
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: 6,
                  padding: '8px 12px',
                  margin: '0 0 12px',
                  fontSize: 12,
                  color: '#ccc',
                  lineHeight: 1.6,
                }}>
                  <div><span style={{ color: '#777' }}>Valor:</span> {receipt.amount_on_receipt !== null ? `R$ ${receipt.amount_on_receipt.toFixed(2).replace('.', ',')}` : '—'}{receipt.amount_on_receipt !== null && receipt.amount_on_receipt >= 50 ? ` (${Math.floor(receipt.amount_on_receipt / 50)} codigos)` : ''}</div>
                  <div><span style={{ color: '#777' }}>CNPJ:</span> {receipt.cnpj_on_receipt ?? '—'}</div>
                  <div><span style={{ color: '#777' }}>Data:</span> {receipt.receipt_date ?? '—'}</div>
                  {receipt.ai_confidence && <div><span style={{ color: '#777' }}>Confianca:</span> {receipt.ai_confidence}</div>}
                </div>
              )}

              {/* ── Timestamp ── */}
              <p style={{ color: '#555', fontSize: 11, margin: '0 0 16px' }}>
                Enviado em {formatBrDate(receipt.created_at)}
              </p>

              {/* ── Action buttons ── */}
              {(!isActive) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button style={btnStyle('yellow')} onClick={() => openAction(receipt.id, 'approve')}>
                    Aprovar manualmente
                  </button>
                  <button style={btnStyle('red')} onClick={() => openAction(receipt.id, 'reject')}>
                    Rejeitar manualmente
                  </button>
                  <button style={btnStyle('gray')} onClick={() => openAction(receipt.id, 'reprocess')}>
                    Adicionei email, reprocessar
                  </button>
                </div>
              )}

              {/* ── Inline action form ── */}
              {isActive && activeAction?.type === 'approve' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ color: '#ccc', fontSize: 13 }}>Quantos codigos?</label>
                  <input
                    type="number"
                    min={1}
                    value={approveCount}
                    onChange={e => setApproveCount(e.target.value)}
                    style={{ ...inputStyle, width: 100 }}
                  />
                  {actionError && <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0 }}>{actionError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={btnStyle('yellow')} disabled={actionLoading} onClick={() => handleApprove(receipt.id)}>
                      {actionLoading ? 'Processando...' : 'Confirmar aprovacao'}
                    </button>
                    <button style={btnStyle('gray')} disabled={actionLoading} onClick={closeAction}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {isActive && activeAction?.type === 'reject' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ color: '#ccc', fontSize: 13 }}>Motivo da rejeicao</label>
                  <select
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value as AdminRejectionReason)}
                    style={{ ...inputStyle }}
                  >
                    <option value="">Selecionar...</option>
                    {REJECTION_REASONS.map(r => (
                      <option key={r} value={r}>{REJECTION_LABELS[r]}</option>
                    ))}
                  </select>
                  {actionError && <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0 }}>{actionError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={btnStyle('red')} disabled={actionLoading} onClick={() => handleReject(receipt.id)}>
                      {actionLoading ? 'Processando...' : 'Confirmar rejeicao'}
                    </button>
                    <button style={btnStyle('gray')} disabled={actionLoading} onClick={closeAction}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {isActive && activeAction?.type === 'reprocess' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ color: '#ccc', fontSize: 13 }}>E-mail do participante</label>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={reprocessEmail}
                    onChange={e => setReprocessEmail(e.target.value)}
                    style={inputStyle}
                  />
                  {actionError && <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0 }}>{actionError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={btnStyle('gray')} disabled={actionLoading} onClick={() => handleReprocess(receipt.id)}>
                      {actionLoading ? 'Salvando...' : 'Salvar e reprocessar'}
                    </button>
                    <button style={btnStyle('gray')} disabled={actionLoading} onClick={closeAction}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

            </div>
          )
        })}
      </div>
    </main>
  )
}
