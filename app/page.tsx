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
          A cada R$50 em compras em uma das Unidades Panini XP Participantes, você recebe 1 código para concorrer a prêmios da Copa do Mundo 2026.
        </p>

        {/* ── PRIZES ───────────────────────────────────────────── */}
        <div style={{ width: '100%', maxWidth: 560, margin: '0 0 32px' }}>
          <p
            style={{
              color: '#FFD600',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              textAlign: 'center',
              margin: '0 0 16px',
            }}
          >
            Prêmios incríveis te esperam
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {[
              { emoji: '👕', label: 'Camisa oficial' },
              { emoji: '🏆', label: 'Bola oficial' },
              { emoji: '📖', label: 'Álbum' },
              { emoji: '📦', label: 'Box de Figurinhas' },
            ].map(prize => (
              <div
                key={prize.label}
                style={{
                  flex: '1 1 110px',
                  backgroundColor: 'rgba(0,0,0,0.25)',
                  borderRadius: 12,
                  padding: '16px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 32 }}>{prize.emoji}</span>
                <span style={{ color: '#aaa', fontSize: 12, textAlign: 'center', lineHeight: 1.3 }}>
                  {prize.label}
                </span>
              </div>
            ))}
          </div>
        </div>

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
          Quero me cadastrar
        </Link>

        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 14 }}>
          Cadastro gratuito • leva menos de 10 segundos
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 8 }}>
          Campanha válida até 31/07/2026
        </p>
      </section>

      <div style={{ width: '100%', maxWidth: 480, padding: '0 16px' }}>

        {/* ── HOW IT WORKS ─────────────────────────────────────── */}
        <section style={{ padding: '48px 0' }}>
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
                title: 'Compre',
                desc: 'Compre suas figurinhas Panini em uma das Unidades Panini XP Participantes.',
              },
              {
                step: '2',
                title: 'Cadastre-se',
                desc: 'Faça seu cadastro gratuitamente.',
              },
              {
                step: '3',
                title: 'Concorra',
                desc: 'Assim que lançarmos as vendas das figurinhas, você poderá registrar suas compras e ganhar códigos para o sorteio.',
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
        <section style={{ padding: '48px 0' }}>
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
              Participantes
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
              {participantCount === 1 ? 'colecionador já entrou na campanha' : 'colecionadores já entraram na campanha'}
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
            padding: '48px 0',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: '#242424',
              borderRadius: 16,
              padding: '32px 24px',
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
              Entre no sorteio da Copa
            </p>
            <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
              Cadastre-se agora e prepare-se para concorrer.
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
              Quero me cadastrar
            </Link>
          </div>
        </section>

        {/* ── WHERE TO FIND ─────────────────────────────────────── */}
        <section style={{ padding: '48px 0 64px' }}>
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
            Unidades Panini XP Participantes
          </h2>

          <div
            style={{
              backgroundColor: '#242424',
              borderRadius: 14,
              padding: '20px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {[
              { name: 'Centro Campinas', url: 'https://maps.google.com/?q=Rua+General+Osório+1285+Campinas+São+Paulo' },
              { name: 'Shopping Parque das Bandeiras — Piso L2, ao lado da Rihappy', url: 'https://maps.google.com/?q=Shopping+Parque+das+Bandeiras+Campinas' },
              { name: 'Shopping Parque das Bandeiras — Piso L3', url: 'https://maps.google.com/?q=Shopping+Parque+das+Bandeiras+Campinas' },
              { name: 'Shopping Iguatemi Campinas — Piso L5', url: 'https://maps.google.com/?q=Shopping+Iguatemi+Campinas' },
              { name: 'Shopping Metrô Itaquera — Piso L5', url: 'https://maps.google.com/?q=Shopping+Metro+Itaquera+São+Paulo' },
              { name: 'Shopping Jardim Sul — Piso L5', url: 'https://maps.google.com/?q=Shopping+Jardim+Sul+São+Paulo' },
              { name: 'Shopping Centervale — Piso L5', url: 'https://maps.google.com/?q=Shopping+Centervale+São+José+dos+Campos' },
              { name: 'Shopping Miramar — Piso L5', url: 'https://maps.google.com/?q=Shopping+Miramar+Santos' },
              { name: 'Pantanal Shopping — Piso L5', url: 'https://maps.google.com/?q=Pantanal+Shopping+Cuiabá' },
              { name: 'Condomínio Quinta da Baroneza — Clube da Mata', url: 'https://maps.google.com/?q=Quinta+da+Baroneza+Porto+Feliz' },
            ].map(loc => (
              <a
                key={loc.name}
                href={loc.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#FFD600',
                  fontSize: 14,
                  textDecoration: 'none',
                  lineHeight: 1.4,
                }}
              >
                {loc.name}
              </a>
            ))}
          </div>
        </section>

      </div>
    </main>
  )
}
