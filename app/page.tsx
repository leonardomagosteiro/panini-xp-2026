import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

async function getTop5() {
  const { data } = await supabase
    .from('participants')
    .select('nickname, code_count')
    .order('code_count', { ascending: false })
    .limit(5)

  return data ?? []
}

export default async function Home() {
  const top5 = await getTop5()

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
                title: 'Cadastre seu valor gasto',
                desc: 'Escaneie o QR Code na loja e informe o valor da sua compra.',
              },
              {
                step: '3',
                title: 'Receba codigos e concorra a premios',
                desc: 'A cada R$50 gastos voce recebe 1 codigo para o sorteio. Quanto mais voce compra, maiores as chances!',
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

        {/* ── TOP 5 RANKING TEASER ─────────────────────────────── */}
        <section style={{ paddingBottom: 48 }}>
          <h2
            style={{
              color: '#FFD600',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              textAlign: 'center',
              margin: '0 0 20px',
            }}
          >
            Quem esta na frente
          </h2>

          <div
            style={{
              backgroundColor: '#242424',
              borderRadius: 16,
              overflow: 'hidden',
              marginBottom: 14,
            }}
          >
            {top5.length === 0 ? (
              <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                <p style={{ color: '#555', fontSize: 14, margin: 0 }}>
                  Seja o primeiro a participar!
                </p>
              </div>
            ) : (
              top5.map((p, i) => {
                const position = i + 1
                const medalColors: Record<number, string> = {
                  1: '#FFD700',
                  2: '#C0C0C0',
                  3: '#CD7F32',
                }
                const medalColor = medalColors[position]

                return (
                  <div
                    key={`${p.nickname}-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '13px 18px',
                      borderBottom: i < top5.length - 1 ? '1px solid #2e2e2e' : 'none',
                    }}
                  >
                    <span
                      style={{
                        color: medalColor ?? '#555',
                        fontWeight: 700,
                        fontSize: 14,
                        minWidth: 20,
                        textAlign: 'center',
                      }}
                    >
                      {position}
                    </span>
                    <span
                      style={{
                        color: '#ccc',
                        fontSize: 14,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.nickname}
                    </span>
                    <span style={{ color: '#FFD600', fontWeight: 700, fontSize: 14 }}>
                      {p.code_count}{' '}
                      <span style={{ color: '#555', fontWeight: 400, fontSize: 12 }}>
                        {p.code_count === 1 ? 'cod.' : 'cods.'}
                      </span>
                    </span>
                  </div>
                )
              })
            )}
          </div>

          <Link
            href="/ranking"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '12px 0',
              borderRadius: 10,
              border: '1px solid #333',
              color: '#FFD600',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Ver ranking completo
          </Link>
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
              Cadastre sua compra agora e garanta seus codigos. Campanha encerra em 31 de julho de 2026.
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
