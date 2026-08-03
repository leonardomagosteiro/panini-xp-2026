import Image from 'next/image'

const BRAND = {
  yellow: '#FFD600',
  black: '#1A1A1A',
}

export default function CadastroPage() {
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
          src="/logo-panini-xp.png"
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
            padding: '28px 24px',
          }}
        >
          <p style={{ color: BRAND.yellow, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
            Campanha encerrada
          </p>
          <p style={{ color: '#aaa', fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
            A promoção Panini XP 2026 foi encerrada. Agradecemos a todos os participantes!
          </p>
          <p style={{ color: '#aaa', fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
            Os sorteios foram realizados ao vivo no nosso Instagram e os ganhadores já foram contatados.
          </p>
          <p style={{ color: '#aaa', fontSize: 15, lineHeight: 1.7 }}>
            Siga{' '}
            <a
              href="https://instagram.com/paninixp"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: BRAND.yellow, textDecoration: 'underline' }}
            >
              @paninixp
            </a>{' '}
            para novidades.
          </p>
        </div>
      </div>
    </main>
  )
}
