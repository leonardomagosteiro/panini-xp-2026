import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

async function getParticipantCount() {
  const { count } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })

  return count ?? 0
}

export default async function Home() {
  const participantCount = await getParticipantCount()

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#1A1A1A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowX: 'hidden',
      }}
    >
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section
        style={{
          width: '100%',
          background: 'linear-gradient(180deg, #CC0000 0%, #1A1A1A 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '40px 24px 56px',
          textAlign: 'center',
        }}
      >
        <Image
          src="/Logo Panini XP.png"
          alt="Panini XP"
          width={210}
          height={84}
          style={{ objectFit: 'contain', marginBottom: 32 }}
          priority
        />

        <h1
          style={{
            color: '#FFD600',
            fontSize: 32,
            fontWeight: 900,
            lineHeight: 1.15,
            margin: '0 0 16px',
            letterSpacing: -0.5,
          }}
        >
          Compre, cadastre
          <br />e concorra!
        </h1>

        <p
          style={{
            color: '#fff',
            fontSize: 16,
            lineHeight: 1.6,
            margin: '0 0 32px',
            maxWidth: 320,
            opacity: 0.9,
          }}
        >
          Cada R$50 em produtos Panini XP vale 1 codigo no sorteio de premios da Copa do Mundo 2026.
        </p>

        <Link
          href="/cadastro"
          style={{
            display: 'inline-block',
            backgroundColor: '#FFD600',
            color: '#1A1A1A',
            fontSize: 17,
            fontWeight: 800,
            padding: '15px 40px',
            borderRadius: 12,
            textDecoration: 'none',
            letterSpacing: 0.3,
          }}
        >
          Cadastrar agora
        </Link>

        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 14 }}>
          Campanha valida ate 31 de julho de 2026
        </p>
      </section>

      <div style={{ width: '100%', maxWidth: 480, padding: '0 16px' }}>

        {/* ── HOW IT WORKS ─────────────────────────────────────── */}
        <section style={{ padding: '48px 0 40px' }}>
          <h2
            style={{
              color: '#FFD600',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              textAlign: 'center',
              margin: '0 0 28px',
            }}
          >
            Como funciona
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              {
                step: '1',
                title: 'Compre produtos Panini XP',
                desc: 'Adquira produtos Panini XP em lojas participantes.',
              },
              {
                step: '2',
                title: 'Cadastre-se na campanha',
                desc: 'Escaneie o QR Code na loja e faca seu cadastro gratuitamente.',
              },
              {
                step: '3',
                title: 'Concorra a premios incriveis',
                desc: 'Em breve voce podera registrar suas compras e ganhar codigos para o sorteio.',
              },
            ].map(item => (
              <div
                key={item.step}
                style={{
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                  backgroundColor: '#242424',
                  borderRadius: 14,
                  padding: '18px 20px',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    backgroundColor: '#CC0000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>
                    {item.step}
                  </span>
                </div>
                <div>
                  <p
                    style={{
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 700,
                      margin: '0 0 4px',
                    }}
                  >
                    {item.title}
                  </p>
                  <p style={{ color: '#888', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PARTICIPANT COUNTER ───────────────────────────────── */}
        <section style={{ paddingBottom: 48 }}>
          <div
            style={{
              backgroundColor: '#242424',
              borderRadius: 16,
              padding: '36px 24px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                color: '#FFD600',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: 'uppercase',
                margin: '0 0 16px',
              }}
            >
              Comunidade
            </p>
            <p
              style={{
                color: '#fff',
                fontSize: 42,
                fontWeight: 900,
                lineHeight: 1,
                margin: '0 0 10px',
                letterSpacing: -1,
              }}
            >
              {participantCount.toLocaleString('pt-BR')}
            </p>
            <p style={{ color: '#aaa', fontSize: 15, margin: 0 }}>
              {participantCount === 1 ? 'participante cadastrado' : 'participantes cadastrados'}
            </p>
            {participantCount === 0 && (
              <p style={{ color: '#555', fontSize: 13, marginTop: 8, marginBottom: 0 }}>
                Seja o primeiro a participar!
              </p>
            )}
          </div>
        </section>

        {/* ── BOTTOM CTA ───────────────────────────────────────── */}
        <section
          style={{
            paddingBottom: 64,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: '#242424',
              borderRadius: 16,
              padding: '32px 24px',
              marginBottom: 16,
            }}
          >
            <p
              style={{
                color: '#FFD600',
                fontSize: 20,
                fontWeight: 800,
                margin: '0 0 10px',
                lineHeight: 1.3,
              }}
            >
              Pronto para concorrer?
            </p>
            <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
              Cadastre-se agora e faca parte da campanha. Campanha encerra em 31 de julho de 2026.
            </p>
            <Link
              href="/cadastro"
              style={{
                display: 'block',
                backgroundColor: '#FFD600',
                color: '#1A1A1A',
                fontSize: 17,
                fontWeight: 800,
                padding: '15px 0',
                borderRadius: 12,
                textDecoration: 'none',
                letterSpacing: 0.3,
              }}
            >
              Cadastrar agora
            </Link>
          </div>
        </section>

      </div>
    </main>
  )
}
