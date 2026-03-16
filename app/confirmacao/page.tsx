import Image from 'next/image'
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
    .select('id, nickname')
    .eq('id', id)
    .single()

  if (participantError || !participant) {
    return <ErrorScreen message="Participante nao encontrado. Verifique o link e tente novamente." />
  }

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
        <div
          style={{
            backgroundColor: '#242424',
            borderRadius: 16,
            padding: '36px 24px',
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
              margin: '0 auto 24px',
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
              margin: '0 0 20px',
              lineHeight: 1.2,
            }}
          >
            Voce esta cadastrado, {participant.nickname}!
          </h1>

          <p style={{ color: '#ccc', fontSize: 15, margin: 0, lineHeight: 1.7 }}>
            Em breve voce podera registrar suas compras e concorrer a premios incriveis da Copa do Mundo 2026. Fique ligado!
          </p>
        </div>
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
