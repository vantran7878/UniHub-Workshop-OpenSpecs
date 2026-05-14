import { signOut } from '@/lib/actions/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  await signOut()
  return NextResponse.redirect(new URL('/', request.url))
}
