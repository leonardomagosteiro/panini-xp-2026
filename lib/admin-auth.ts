import { NextRequest } from 'next/server'

// TODO: replace with process.env.ADMIN_PASSWORD before production launch
export const ADMIN_PASSWORD = 'panini2026'

export function validateAdminSession(request: NextRequest): boolean {
  const cookie = request.cookies.get('admin_session')
  return cookie?.value === ADMIN_PASSWORD
}
