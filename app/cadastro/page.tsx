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
Coletamos: nome completo, CPF, WhatsApp, e-mail (opcional) e apelido publico.

2. FINALIDADE
Os dados sao usados exclusivamente para:
- Identificar o participante na campanha promocional
- Exibir o ranking publico (apenas apelido)
- Cumprir obrigacoes legais

3. DADOS PUBLICOS E PRIVADOS
Apenas o apelido e exibido publicamente no ranking. Nome, CPF, WhatsApp e e-mail NUNCA sao divulgados.

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
  onBlur,
  type = 'text',
  placeholder,
  required = false,
  inputMode,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  type?: string
  placeholder?: string
  required?: boolean
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>['inputMode']
  error?: string
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
          border: `1px solid ${error ? '#ff6b6b' : '#444'}`,
          borderRadius: 8,
          padding: '12px 14px',
          color: '#fff',
          fontSize: 16,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = error ? '#ff6b6b' : BRAND.yellow)}
        onBlur={e => {
          e.currentTarget.style.borderColor = error ? '#ff6b6b' : '#444'
          onBlur?.()
        }}
      />
      {error && (
        <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0 }}>{error}</p>
      )}
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
  const [cpfError, setCpfError] = useState('')
  const [returningParticipant, setReturningParticipant] = useState<{ id: string; nickname: string } | null>(null)

  const [nickname, setNickname] = useState('')
  const [fullName, setFullName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [lgpdConsent, setLgpdConsent] = useState(false)

  function handleCPFBlur() {
    const clean = cpf.replace(/\D/g, '')
    if (clean.length === 0) return
    if (clean.length !== 11 || !validateCPF(cpf)) {
      setCpfError('CPF inválido. Verifique os números digitados.')
    } else {
      setCpfError('')
    }
  }

  async function handleCPFLookup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cleanCPF = cpf.replace(/\D/g, '')
    if (cleanCPF.length !== 11 || !validateCPF(cpf)) {
      setCpfError('CPF inválido. Verifique os números digitados.')
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
        router.push(`/enviar-recibo?cpf=${encodeURIComponent(cpf)}&welcome=1&nickname=${encodeURIComponent(data.participant.nickname)}`)
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

    if (!validateCPF(cpf)) {
      setCpfError('CPF inválido. Verifique os números digitados.')
      return
    }

    if (!nickname.trim() || !fullName.trim() || !whatsapp.trim()) {
      setError('Preencha todos os campos obrigatorios.')
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
          store_origin: storeOrigin || null,
          lgpd_consent: true,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao realizar cadastro. Tente novamente.')
        return
      }

      router.push(`/enviar-recibo?cpf=${encodeURIComponent(cpf)}&new=1`)
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
              <p style={sectionTitle}>Pre-cadastro</p>
              <p style={{ color: '#aaa', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
                Digite seu CPF para verificarmos seu cadastro.
              </p>
              <InputField
                label="CPF"
                value={cpf}
                onChange={v => { setCpf(formatCPF(v)); setCpfError('') }}
                onBlur={handleCPFBlur}
                placeholder="000.000.000-00"
                inputMode="numeric"
                required
                error={cpfError}
              />
            </div>

            {error && (
              <p style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>{error}</p>
            )}

            <button type="submit" style={buttonStyle} disabled={loading}>
              {loading ? 'Verificando...' : 'Continuar'}
            </button>
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
                  onChange={v => { setCpf(formatCPF(v)); setCpfError('') }}
                  onBlur={handleCPFBlur}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  required
                  error={cpfError}
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

            <div style={{ ...cardStyle }}>
              <p style={sectionTitle}>Consentimento</p>
              <PrivacyPolicyToggle consent={lgpdConsent} onConsentChange={setLgpdConsent} />
            </div>

            {error && (
              <p style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>{error}</p>
            )}

            <button type="submit" style={buttonStyle} disabled={loading}>
              {loading ? 'Cadastrando...' : 'Cadastrar'}
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
          <div style={cardStyle}>
            <p
              style={{
                color: BRAND.yellow,
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              Voce ja esta cadastrado, {returningParticipant.nickname}!
            </p>
            <p style={{ color: '#aaa', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
              Fique ligado para novidades da campanha.
            </p>
            <button
              type="button"
              onClick={() => { setError(''); setCpf(''); setMode('cpf-check') }}
              style={{
                background: 'none',
                border: `1px solid #444`,
                borderRadius: 8,
                color: '#aaa',
                fontSize: 14,
                cursor: 'pointer',
                padding: '10px 16px',
              }}
            >
              Voltar
            </button>
          </div>
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
