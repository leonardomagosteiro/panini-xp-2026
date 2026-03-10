'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

const BRAND = {
  yellow: '#FFD600',
  red: '#CC0000',
  black: '#1A1A1A',
}

const PRIVACY_POLICY = `POLITICA DE PRIVACIDADE — CAMPANHA PANINI XP FIFA WORLD CUP 2026

1. DADOS COLETADOS
Coletamos: nome completo, CPF, WhatsApp, e-mail (opcional), apelido publico e valor gasto na compra.

2. FINALIDADE
Os dados sao usados exclusivamente para:
- Identificar o participante na campanha promocional
- Gerar e atribuir codigos para o sorteio de premios
- Exibir o ranking publico (apenas apelido e quantidade de codigos)
- Cumprir obrigacoes legais

3. DADOS PUBLICOS E PRIVADOS
Apenas o apelido e a quantidade de codigos sao exibidos publicamente no ranking. Nome, CPF, WhatsApp e e-mail NUNCA sao divulgados.

4. COMPARTILHAMENTO
Nao vendemos nem compartilhamos seus dados com terceiros, exceto quando exigido por lei ou para operacao tecnica da plataforma (Supabase, servidor de hospedagem).

5. RETENCAO
Os dados sao mantidos pelo periodo da campanha e ate 5 anos apos seu encerramento, conforme exigido pela legislacao fiscal e de defesa do consumidor.

6. SEUS DIREITOS (LGPD — Lei 13.709/2018)
Voce tem direito a: acessar seus dados, corrigir informacoes incorretas, solicitar exclusao, revogar consentimento e obter informacoes sobre o uso dos dados. Para exercer esses direitos, entre em contato pelo WhatsApp da loja onde realizou sua compra.

7. SEGURANCA
Utilizamos criptografia e controle de acesso para proteger seus dados contra acesso nao autorizado.

8. CONSENTIMENTO
Ao marcar a caixa de consentimento, voce declara ter lido e concordado com esta politica.`

type Mode = 'cpf-check' | 'new' | 'returning'

function formatCPF(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function formatWhatsApp(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function PrivacyPolicyToggle({
  consent,
  onConsentChange,
}: {
  consent: boolean
  onConsentChange: (v: boolean) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ border: `1px solid #333`, borderRadius: 8, overflow: 'hidden' }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '14px 16px',
          cursor: 'pointer',
          backgroundColor: consent ? 'rgba(255,214,0,0.08)' : 'transparent',
        }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={e => onConsentChange(e.target.checked)}
          style={{
            width: 20,
            height: 20,
            marginTop: 2,
            accentColor: BRAND.yellow,
            flexShrink: 0,
            cursor: 'pointer',
          }}
        />
        <span style={{ color: '#e0e0e0', fontSize: 14, lineHeight: 1.5 }}>
          Li e aceito a Politica de Privacidade e consinto com o tratamento dos meus dados para participar da campanha.
        </span>
      </label>

      <div
        style={{
          borderTop: '1px solid #333',
          padding: '10px 16px',
          backgroundColor: '#111',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'none',
            border: 'none',
            color: BRAND.yellow,
            fontSize: 13,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 11, display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>&#9654;</span>
          {open ? 'Ocultar politica completa' : 'Ver politica completa'}
        </button>

        {open && (
          <div
            style={{
              marginTop: 12,
              color: '#aaa',
              fontSize: 12,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              maxHeight: 300,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {PRIVACY_POLICY}
          </div>
        )}
      </div>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  inputMode,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ color: '#ccc', fontSize: 13, fontWeight: 500 }}>
        {label} {required && <span style={{ color: BRAND.yellow }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        required={required}
        style={{
          backgroundColor: '#2a2a2a',
          border: '1px solid #444',
          borderRadius: 8,
          padding: '12px 14px',
          color: '#fff',
          fontSize: 16,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = BRAND.yellow)}
        onBlur={e => (e.currentTarget.style.borderColor = '#444')}
      />
    </div>
  )
}

function CadastroForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeOrigin = searchParams.get('loja') || ''

  const [mode, setMode] = useState<Mode>('cpf-check')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [cpf, setCpf] = useState('')
  const [returningParticipant, setReturningParticipant] = useState<{ id: string; nickname: string } | null>(null)

  const [nickname, setNickname] = useState('')
  const [fullName, setFullName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [amountSpent, setAmountSpent] = useState('')
  const [lgpdConsent, setLgpdConsent] = useState(false)

  const parsedAmount = parseFloat(amountSpent.replace(',', '.')) || 0
  const codePreview = Math.floor(parsedAmount / 50)

  async function handleCPFLookup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cleanCPF = cpf.replace(/\D/g, '')
    if (cleanCPF.length !== 11) {
      setError('Digite um CPF valido com 11 digitos.')
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
        setError(data.error || 'Erro ao buscar CPF. Tente novamente.')
        return
      }

      if (data.found) {
        setReturningParticipant(data.participant)
        setAmountSpent('')
        setLgpdConsent(false)
        setMode('returning')
      } else {
        setMode('new')
      }
    } catch {
      setError('Erro de conexao. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleNewSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!lgpdConsent) {
      setError('Voce precisa aceitar a Politica de Privacidade para continuar.')
      return
    }

    if (!nickname.trim() || !fullName.trim() || !whatsapp.trim() || !amountSpent) {
      setError('Preencha todos os campos obrigatorios.')
      return
    }

    if (parsedAmount < 50) {
      setError('Valor minimo para participar e R$50.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'new',
          nickname: nickname.trim(),
          full_name: fullName.trim(),
          cpf,
          whatsapp,
          email: email.trim() || null,
          amount_spent: parsedAmount,
          store_origin: storeOrigin || null,
          lgpd_consent: true,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao realizar cadastro. Tente novamente.')
        return
      }

      router.push(`/confirmacao?id=${data.participant_id}`)
    } catch {
      setError('Erro de conexao. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReturningSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!lgpdConsent) {
      setError('Voce precisa aceitar a Politica de Privacidade para continuar.')
      return
    }

    if (parsedAmount < 50) {
      setError('Valor minimo para participar e R$50.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'returning',
          participant_id: returningParticipant!.id,
          amount_spent: parsedAmount,
          lgpd_consent: true,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao registrar compra. Tente novamente.')
        return
      }

      router.push(`/confirmacao?id=${data.participant_id}`)
    } catch {
      setError('Erro de conexao. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

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
      {/* Logo */}
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

        {/* ── MODE: CPF CHECK ────────────────────────────────── */}
        {mode === 'cpf-check' && (
          <form onSubmit={handleCPFLookup}>
            <div style={cardStyle}>
              <p style={sectionTitle}>Ja participou antes?</p>
              <p style={{ color: '#aaa', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
                Digite seu CPF para verificarmos seu cadastro.
              </p>
              <InputField
                label="CPF"
                value={cpf}
                onChange={v => setCpf(formatCPF(v))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                required
              />
            </div>

            {error && (
              <p style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>{error}</p>
            )}

            <button type="submit" style={buttonStyle} disabled={loading}>
              {loading ? 'Verificando...' : 'Continuar'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 20, color: '#777', fontSize: 14 }}>
              Primeira vez?{' '}
              <button
                type="button"
                onClick={() => { setError(''); setMode('new') }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: BRAND.yellow,
                  fontSize: 14,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Fazer novo cadastro
              </button>
            </p>
          </form>
        )}

        {/* ── MODE: NEW CUSTOMER ─────────────────────────────── */}
        {mode === 'new' && (
          <form onSubmit={handleNewSubmit}>
            <div style={cardStyle}>
              <p style={sectionTitle}>Seu apelido publico</p>
              <p style={{ color: '#aaa', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                Este nome aparece no ranking. Escolha algo que nao revele sua identidade se preferir.
              </p>
              <InputField
                label="Apelido"
                value={nickname}
                onChange={setNickname}
                placeholder="Ex: Craque2026"
                required
              />
            </div>

            <div style={cardStyle}>
              <p style={sectionTitle}>Seus dados</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <InputField
                  label="Nome Completo"
                  value={fullName}
                  onChange={setFullName}
                  placeholder="Como no documento"
                  required
                />
                <InputField
                  label="CPF"
                  value={cpf}
                  onChange={v => setCpf(formatCPF(v))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  required
                />
                <InputField
                  label="WhatsApp"
                  value={whatsapp}
                  onChange={v => setWhatsapp(formatWhatsApp(v))}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                  required
                />
                <InputField
                  label="E-mail (opcional)"
                  value={email}
                  onChange={setEmail}
                  type="email"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div style={cardStyle}>
              <p style={sectionTitle}>Valor da compra</p>
              <InputField
                label="Quanto voce gastou? (R$)"
                value={amountSpent}
                onChange={setAmountSpent}
                type="number"
                placeholder="Ex: 150"
                inputMode="decimal"
                required
              />
              {codePreview > 0 && (
                <div
                  style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255,214,0,0.1)',
                    borderRadius: 8,
                    border: `1px solid ${BRAND.yellow}`,
                    textAlign: 'center',
                  }}
                >
                  <span style={{ color: BRAND.yellow, fontWeight: 700, fontSize: 18 }}>
                    Voce vai receber {codePreview} {codePreview === 1 ? 'codigo' : 'codigos'}!
                  </span>
                  <p style={{ color: '#aaa', fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                    1 codigo a cada R$50 gastos
                  </p>
                </div>
              )}
            </div>

            <div style={{ ...cardStyle }}>
              <p style={sectionTitle}>Consentimento</p>
              <PrivacyPolicyToggle consent={lgpdConsent} onConsentChange={setLgpdConsent} />
            </div>

            {error && (
              <p style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>{error}</p>
            )}

            <button type="submit" style={buttonStyle} disabled={loading}>
              {loading ? 'Cadastrando...' : 'Cadastrar e receber codigos'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 16, color: '#777', fontSize: 13 }}>
              <button
                type="button"
                onClick={() => { setError(''); setMode('cpf-check') }}
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

        {/* ── MODE: RETURNING CUSTOMER ───────────────────────── */}
        {mode === 'returning' && returningParticipant && (
          <form onSubmit={handleReturningSubmit}>
            <div style={cardStyle}>
              <p
                style={{
                  color: BRAND.yellow,
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                Ola, {returningParticipant.nickname}!
              </p>
              <p style={{ color: '#aaa', fontSize: 14, lineHeight: 1.5 }}>
                Bem-vindo de volta. Informe o valor desta compra para receber mais codigos.
              </p>
            </div>

            <div style={cardStyle}>
              <p style={sectionTitle}>Esta compra</p>
              <InputField
                label="Quanto voce gastou desta vez? (R$)"
                value={amountSpent}
                onChange={setAmountSpent}
                type="number"
                placeholder="Ex: 100"
                inputMode="decimal"
                required
              />
              {codePreview > 0 && (
                <div
                  style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255,214,0,0.1)',
                    borderRadius: 8,
                    border: `1px solid ${BRAND.yellow}`,
                    textAlign: 'center',
                  }}
                >
                  <span style={{ color: BRAND.yellow, fontWeight: 700, fontSize: 18 }}>
                    Voce vai receber {codePreview} {codePreview === 1 ? 'codigo' : 'codigos'}!
                  </span>
                  <p style={{ color: '#aaa', fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                    1 codigo a cada R$50 gastos
                  </p>
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <p style={sectionTitle}>Consentimento</p>
              <PrivacyPolicyToggle consent={lgpdConsent} onConsentChange={setLgpdConsent} />
            </div>

            {error && (
              <p style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>{error}</p>
            )}

            <button type="submit" style={buttonStyle} disabled={loading}>
              {loading ? 'Registrando...' : 'Receber meus codigos'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 16, color: '#777', fontSize: 13 }}>
              <button
                type="button"
                onClick={() => { setError(''); setCpf(''); setMode('cpf-check') }}
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
                Nao sou eu — voltar
              </button>
            </p>
          </form>
        )}

      </div>
    </main>
  )
}

export default function CadastroPage() {
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
      <CadastroForm />
    </Suspense>
  )
}
