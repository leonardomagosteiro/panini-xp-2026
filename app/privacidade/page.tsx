import Image from 'next/image'
import Link from 'next/link'

const sections = [
  {
    title: '1. Quais dados coletamos',
    content: `Coletamos os seguintes dados pessoais para fins de participacao na campanha:

- Nome completo
- CPF (Cadastro de Pessoa Fisica)
- Numero de WhatsApp
- Endereco de e-mail (opcional)
- Valor gasto na compra de produtos Panini XP
- Apelido publico (escolhido pelo participante)
- Loja de origem (capturado automaticamente pelo QR Code da loja)`,
  },
  {
    title: '2. Por que coletamos',
    content: `Os dados sao coletados exclusivamente para viabilizar a participacao na campanha promocional Panini XP FIFA World Cup 2026. A coleta e necessaria para:

- Identificar unicamente cada participante e evitar duplicidades
- Calcular a quantidade de codigos a que cada participante tem direito
- Realizar o sorteio de premios de forma justa e auditavel
- Cumprir obrigacoes legais decorrentes da promocao comercial`,
  },
  {
    title: '3. Como usamos seus dados',
    content: `Seus dados sao utilizados da seguinte forma:

- Nome, CPF e WhatsApp: identificacao e contato em caso de premiacao
- E-mail: comunicacao opcional sobre a campanha
- Valor gasto: calculo da quantidade de codigos gerados (1 codigo a cada R$50)
- Apelido: exibicao no ranking publico da campanha

O ranking publico exibe apenas o apelido e a quantidade de codigos. Nenhum dado pessoal sensivel (nome, CPF, WhatsApp ou e-mail) e tornado publico em nenhuma circunstancia.`,
  },
  {
    title: '4. Quem tem acesso aos seus dados',
    content: `O acesso aos seus dados e restrito exclusivamente a equipe responsavel pela campanha Panini XP. Nao compartilhamos, vendemos ou cedemos seus dados a terceiros, exceto:

- Quando exigido por lei ou ordem judicial
- Para provedores de infraestrutura tecnica necessarios ao funcionamento da plataforma (servidores de hospedagem e banco de dados), que operam sob acordos de confidencialidade`,
  },
  {
    title: '5. Por quanto tempo armazenamos',
    content: `Seus dados serao mantidos pelo periodo de vigencia da campanha (ate 31 de julho de 2026) e por ate 90 dias apos o seu encerramento, prazo necessario para conclusao do sorteio, entrega de premios e resolucao de eventuais questionamentos.

Apos esse periodo, os dados serao excluidos de forma segura e irreversivel, salvo obrigacao legal de retencao por prazo superior.`,
  },
  {
    title: '6. Seus direitos como titular dos dados',
    content: `Nos termos da Lei Geral de Protecao de Dados (LGPD — Lei n. 13.709/2018), voce tem direito a:

- Confirmacao da existencia de tratamento dos seus dados
- Acesso aos dados que temos sobre voce
- Correcao de dados incompletos, inexatos ou desatualizados
- Exclusao dos dados pessoais tratados com seu consentimento
- Revogacao do consentimento a qualquer momento
- Informacao sobre o compartilhamento dos seus dados

Para exercer qualquer desses direitos, entre em contato pelo e-mail abaixo. Responderemos em ate 15 dias uteis.`,
  },
  {
    title: '7. Base legal para o tratamento',
    content: `O tratamento dos seus dados e realizado com base no consentimento expresso fornecido no momento do cadastro (Art. 7, I da LGPD) e no legitimo interesse para execucao da promocao comercial (Art. 7, IX da LGPD).`,
  },
  {
    title: '8. Seguranca dos dados',
    content: `Adotamos medidas tecnicas e organizacionais adequadas para proteger seus dados contra acesso nao autorizado, perda, alteracao ou divulgacao indevida, incluindo criptografia em transito e controle de acesso restrito ao banco de dados.`,
  },
  {
    title: '9. Contato',
    content: `Para duvidas, solicitacoes ou exercicio dos seus direitos, entre em contato com o responsavel pelo tratamento dos dados:

E-mail: contato@paninixp.com.br

Esta politica foi atualizada em marco de 2026 e pode ser revisada a qualquer momento. Alteracoes relevantes serao comunicadas aos participantes.`,
  },
]

export default function Privacidade() {
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
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <Link href="/">
          <Image
            src="/Logo Panini XP.png"
            alt="Panini XP"
            width={180}
            height={72}
            style={{ objectFit: 'contain' }}
            priority
          />
        </Link>
      </div>

      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* Heading */}
        <div
          style={{
            backgroundColor: '#242424',
            borderRadius: 16,
            padding: '28px 24px',
            marginBottom: 16,
          }}
        >
          <h1
            style={{
              color: '#FFD600',
              fontSize: 24,
              fontWeight: 800,
              margin: '0 0 8px',
            }}
          >
            Politica de Privacidade
          </h1>
          <p style={{ color: '#666', fontSize: 13, margin: 0 }}>
            Campanha Panini XP FIFA World Cup 2026 — Vigente desde marco de 2026
          </p>
        </div>

        {/* Intro */}
        <div
          style={{
            backgroundColor: '#242424',
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 16,
          }}
        >
          <p style={{ color: '#bbb', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            Esta Politica de Privacidade descreve como coletamos, usamos e protegemos seus dados pessoais no contexto da campanha promocional Panini XP FIFA World Cup 2026, em conformidade com a Lei Geral de Protecao de Dados (LGPD — Lei n. 13.709/2018).
          </p>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sections.map(section => (
            <div
              key={section.title}
              style={{
                backgroundColor: '#242424',
                borderRadius: 16,
                padding: '22px 24px',
              }}
            >
              <h2
                style={{
                  color: '#FFD600',
                  fontSize: 14,
                  fontWeight: 700,
                  margin: '0 0 12px',
                  letterSpacing: 0.3,
                }}
              >
                {section.title}
              </h2>
              <p
                style={{
                  color: '#aaa',
                  fontSize: 14,
                  lineHeight: 1.75,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {section.content}
              </p>
            </div>
          ))}
        </div>

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link
            href="/"
            style={{
              color: '#FFD600',
              fontSize: 14,
              textDecoration: 'underline',
            }}
          >
            Voltar ao inicio
          </Link>
        </div>

      </div>
    </main>
  )
}
