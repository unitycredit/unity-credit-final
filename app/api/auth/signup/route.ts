import { NextRequest, NextResponse } from 'next/server'
import { signupSchema } from '@/lib/validations'
import { prisma } from '@/lib/prisma'
import { callCognitoBoto3 } from '@/lib/aws/cognito-boto3'

export const runtime = 'nodejs'


const toYiddishError = (msg: string) => {
  if (msg.includes('User already registered')) return 'דער אימעיל איז שוין רעגיסטרירט. ביטע נוצט לאגין.'
  if (msg.includes('Password')) return 'פאסווארט איז נישט שטארק גענוג. ביטע נוצט א שטארקערן פאסווארט.'
  return 'א טעות איז פארגעקומען. פרובירט נאכאמאל.'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = signupSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'אומגילטיגע דאטן', details: validation.error.errors }, { status: 400 })
    }

    const { email, password, firstName, lastName, phone } = validation.data
    const emailNorm = String(email || '').trim().toLowerCase()
    const created = await callCognitoBoto3('sign_up', {
      email: emailNorm,
      password: String(password || ''),
      first_name: String(firstName || '').trim(),
      last_name: String(lastName || '').trim(),
      phone: String(phone || '').trim(),
    })
    if (!created.ok) {
      return NextResponse.json({ error: toYiddishError(String((created as any)?.error_code || (created as any)?.error || '')) }, { status: Number((created as any)?.status || 400) })
    }

    // Mirror RDS user row.
    try {
      const existing = await prisma.user.findUnique({ where: { email: emailNorm }, select: { id: true } }).catch(() => null)
      if (!existing?.id) {
        await prisma.user.create({ data: { email: emailNorm, firstName, lastName, phone } as any, select: { id: true } }).catch(() => null)
      } else {
        await prisma.user.update({ where: { id: existing.id }, data: { firstName, lastName, phone } as any, select: { id: true } }).catch(() => null)
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, needsVerification: true, code_delivery: (created as any)?.code_delivery || null }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: toYiddishError(error?.message || '') }, { status: 500 })
  }
}

