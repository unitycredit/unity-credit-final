import { NextResponse } from 'next/server'
import { unityBrainOfficeUrl } from '@/lib/unity-brain-office'

export const runtime = 'nodejs'

export async function OPTIONS() {
  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-App-Id, X-App-Key, X-Api-Key, App-Key',
        'Cache-Control': 'no-store',
      },
    }
  )
}

export async function GET() {
  const base = unityBrainOfficeUrl()
  const url = new URL('/healthz', base)
  const appId = String(process.env.UNITY_CREDIT_APP_ID || process.env.UNITY_APP_ID || 'unity-credit-window').trim()
  const appKey = String(process.env.UNITY_CREDIT_APP_KEY || '').trim()

  const ctrl = new AbortController()
  const timeoutMs = 2500
  const id = setTimeout(() => ctrl.abort(), timeoutMs)

  try {
    const resp = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
      headers: {
        ...(appId ? { 'X-App-Id': appId, 'x-app-id': appId } : {}),
        ...(appKey ? { 'X-Api-Key': appKey, 'X-App-Key': appKey, 'App-Key': appKey } : {}),
      },
    })
    const text = await resp.text().catch(() => '')
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return NextResponse.json(
      {
        ok: resp.ok,
        status: resp.status,
        url: url.toString(),
        app_id_present: Boolean(appId),
        app_key_present: Boolean(appKey),
        json,
        text: json ? null : text,
      },
      {
        status: resp.ok ? 200 : resp.status,
        headers: {
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, status: 0, url: url.toString(), error: e?.name === 'AbortError' ? 'timeout' : String(e?.message || 'fetch failed') },
      { status: 502, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }
    )
  } finally {
    clearTimeout(id)
  }
}


