import Image from 'next/image'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'

export default async function Confirmacao({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  const { id } = searchParams

  if (!id) {
    return <ErrorScreen message="Link invalido. Nenhum participante informado." />
  }

  const supabase = createAdminClient()

  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select('id, nickname, code_count')
    .eq('id', id)
    .single()

  if (participantError || !participant) {
    return <ErrorScreen message="Participante nao encontrado. Verifique o link e tente novamente." />
  }

  const { data: codes, error: codesError } = await supabase
    .from('codes')
    .select('code')
    .eq('participant_id', id)
    .order('created_at', { ascending: true })

  if (codesError) {
    return <ErrorScreen message="Erro ao carregar seus codigos. Tente recarregar a pagina." />
  }

  const codeList = codes ?? []

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#1A1A1A',
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

        {/* Success header */}
        <div
          style={{
            backgroundColor: '#242424',
            borderRadius: 16,
            padding: '28px 24px',
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,214,0,0.12)',
              border: '2px solid #FFD600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 28,
            }}
          >
            &#10003;
          </div>

          <h1
            style={{
              color: '#FFD600',
              fontSize: 26,
              fontWeight: 800,
              margin: '0 0 10px',
              lineHeight: 1.2,
            }}
          >
            Parabens, {participant.nickname}!
          </h1>

          <p style={{ color: '#ccc', fontSize: 15, margin: 0, lineHeight: 1.5 }}>
            {codeList.length === 1
              ? 'Voce recebeu 1 codigo para o sorteio:'
              : `Voce recebeu ${codeList.length} codigos para o sorteio:`}
          </p>
        </div>

        {/* Codes list */}
        <div
          style={{
            backgroundColor: '#242424',
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 16,
          }}
        >
          <p
            style={{
              color: '#FFD600',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            Seus codigos
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {codeList.map((row, i) => (
              <div
                key={row.code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: 10,
                  padding: '12px 16px',
                }}
              >
                <span
                  style={{
                    color: '#555',
                    fontSize: 12,
                    fontWeight: 700,
                    minWidth: 24,
                    textAlign: 'right',
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    color: '#FFD600',
                    fontFamily: 'monospace',
                    fontSize: 17,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    flex: 1,
                  }}
                >
                  {row.code}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Info box */}
        <div
          style={{
            backgroundColor: 'rgba(204,0,0,0.1)',
            border: '1px solid rgba(204,0,0,0.3)',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 24,
          }}
        >
          <p style={{ color: '#ff9999', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Guarde estes codigos. Eles serao usados no sorteio de premios da campanha Panini XP FIFA World Cup 2026.
          </p>
        </div>

        {/* Ranking button */}
        <Link
          href="/ranking"
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 0',
            borderRadius: 10,
            backgroundColor: '#FFD600',
            color: '#1A1A1A',
            fontSize: 16,
            fontWeight: 700,
            textAlign: 'center',
            textDecoration: 'none',
            letterSpacing: 0.5,
            boxSizing: 'border-box',
          }}
        >
          Ver meu lugar no ranking
        </Link>

      </div>
    </main>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#1A1A1A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
      }}
    >
      <Image
        src="/Logo Panini XP.png"
        alt="Panini XP"
        width={180}
        height={72}
        style={{ objectFit: 'contain', marginBottom: 32 }}
      />
      <div
        style={{
          backgroundColor: '#242424',
          borderRadius: 16,
          padding: '28px 24px',
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <p style={{ color: '#CC0000', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Ops!
        </p>
        <p style={{ color: '#aaa', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          {message}
        </p>
      </div>
    </main>
  )
}
