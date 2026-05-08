import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_PASSWORD } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  const body = await req.json() as { password?: string }

  if (body.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('admin_session', ADMIN_PASSWORD, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60, // 8 hours
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
