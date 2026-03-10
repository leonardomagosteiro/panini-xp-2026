'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

type Filter = 'geral' | 'semana' | 'mes'

type Participant = {
  nickname: string
  code_count: number
}

const MEDAL = {
  1: { color: '#FFD700', label: '1' },
  2: { color: '#C0C0C0', label: '2' },
  3: { color: '#CD7F32', label: '3' },
} as Record<number, { color: string; label: string }>

function getFilterStart(filter: Filter): string | null {
  if (filter === 'geral') return null

  const now = new Date()

  if (filter === 'semana') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }

  if (filter === 'mes') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return d.toISOString()
  }

  return null
}

export default function Ranking() {
  const [filter, setFilter] = useState<Filter>('geral')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchRanking = useCallback(async (f: Filter) => {
    let query = supabase
      .from('participants')
      .select('nickname, code_count')
      .order('code_count', { ascending: false })

    const start = getFilterStart(f)
    if (start) {
      query = query.gte('created_at', start)
    }

    const { data, error } = await query

    if (!error && data) {
      setParticipants(data)
      setLastUpdated(new Date())
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchRanking(filter)
  }, [filter, fetchRanking])

  useEffect(() => {
    const interval = setInterval(() => fetchRanking(filter), 60_000)
    return () => clearInterval(interval)
  }, [filter, fetchRanking])

  const filters: { key: Filter; label: string }[] = [
    { key: 'geral', label: 'Geral' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'mes', label: 'Este mes' },
  ]

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
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <Image
          src="/Logo Panini XP.png"
          alt="Panini XP"
          width={180}
          height={72}
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>

      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1
            style={{
              color: '#FFD600',
              fontSize: 26,
              fontWeight: 800,
              margin: '0 0 6px',
              letterSpacing: 0.5,
            }}
          >
            Ranking Geral
          </h1>
          <p style={{ color: '#666', fontSize: 12, margin: 0 }}>
            {lastUpdated
              ? `Atualizado as ${lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Carregando...'}
          </p>
        </div>

        {/* Filter buttons */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 20,
            backgroundColor: '#242424',
            borderRadius: 12,
            padding: 6,
          }}
        >
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                flex: 1,
                padding: '9px 4px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: filter === f.key ? '#FFD600' : 'transparent',
                color: filter === f.key ? '#1A1A1A' : '#888',
                fontSize: 13,
                fontWeight: filter === f.key ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ color: '#555', fontSize: 14 }}>Carregando ranking...</p>
          </div>
        ) : participants.length === 0 ? (
          <div
            style={{
              backgroundColor: '#242424',
              borderRadius: 16,
              padding: '40px 24px',
              textAlign: 'center',
            }}
          >
            <p style={{ color: '#555', fontSize: 15, margin: 0 }}>
              Nenhum participante neste periodo ainda.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {participants.map((p, i) => {
              const position = i + 1
              const medal = MEDAL[position]
              const isTop3 = position <= 3

              return (
                <div
                  key={`${p.nickname}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    backgroundColor: isTop3 ? '#2a2a2a' : '#222',
                    border: isTop3 ? `1px solid ${medal.color}33` : '1px solid #2a2a2a',
                    borderRadius: 12,
                    padding: '14px 16px',
                  }}
                >
                  {/* Position */}
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      backgroundColor: isTop3 ? medal.color : '#333',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        color: isTop3 ? '#1A1A1A' : '#666',
                        fontSize: isTop3 ? 14 : 13,
                        fontWeight: 700,
                      }}
                    >
                      {position}
                    </span>
                  </div>

                  {/* Nickname */}
                  <span
                    style={{
                      color: isTop3 ? '#fff' : '#ccc',
                      fontSize: 15,
                      fontWeight: isTop3 ? 700 : 400,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.nickname}
                  </span>

                  {/* Code count */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span
                      style={{
                        color: isTop3 ? medal.color : '#FFD600',
                        fontSize: 16,
                        fontWeight: 700,
                      }}
                    >
                      {p.code_count}
                    </span>
                    <span style={{ color: '#555', fontSize: 11, marginLeft: 4 }}>
                      {p.code_count === 1 ? 'cod.' : 'cods.'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer note */}
        {!loading && participants.length > 0 && (
          <p
            style={{
              color: '#444',
              fontSize: 12,
              textAlign: 'center',
              marginTop: 24,
              lineHeight: 1.5,
            }}
          >
            Ranking atualizado automaticamente a cada 60 segundos.
            {'\n'}Apenas apelido e quantidade de codigos sao exibidos.
          </p>
        )}

      </div>
    </main>
  )
}
