function htmlEscape(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function yiddishSubject(kind: 'otp' | 'welcome', data?: { code?: string }) {
  if (kind === 'otp') {
    const code = String(data?.code || '').trim()
    return code ? `Unity Credit — באַשטעטיקונג־קאָד: ${code}` : 'Unity Credit — באַשטעטיקונג־קאָד'
  }
  return 'Unity Credit — ברוכים־הבאים'
}

export function otpEmail(params: { code: string; minutesValid: number }) {
  const code = String(params.code || '').trim()
  const mins = Number(params.minutesValid) || 10

  const subject = yiddishSubject('otp', { code })
  const text =
    `שלום,\n\n` +
    `דאָ איז אייער Unity Credit באַשטעטיקונג־קאָד:\n\n` +
    `${code}\n\n` +
    `דער קאָד איז גילטיג פאר ${mins} מינוט.\n\n` +
    `אויב איר האָט נישט געבעטן דעם קאָד, קענט איר איגנאָרירן דעם אימעיל.\n\n` +
    `יישר כח,\nUnity Credit`

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#0b0f14;padding:28px;">
    <div style="max-width:720px;margin:0 auto;background:#0f141b;border:1px solid rgba(212,175,55,0.25);border-radius:18px;overflow:hidden;">
      <div style="padding:18px 22px;background:linear-gradient(90deg,#0b0f14,#111827);border-bottom:1px solid rgba(212,175,55,0.25);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="font-weight:900;color:#d4af37;letter-spacing:0.5px;">Unity Credit</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.75);direction:rtl;text-align:right;">אקאונט־וועריפיקאציע</div>
        </div>
        <div style="margin-top:6px;color:rgba(255,255,255,0.85);font-size:12px;direction:rtl;text-align:right;">
          באַשטעטיקונג־קאָד
        </div>
      </div>

      <div style="padding:22px;direction:rtl;text-align:right;color:#e5e7eb;">
        <div style="font-size:14px;color:rgba(255,255,255,0.85);">דאָ איז אייער באַשטעטיקונג־קאָד:</div>
        <div style="margin-top:12px;display:inline-block;padding:12px 16px;border-radius:14px;background:rgba(212,175,55,0.14);border:1px solid rgba(212,175,55,0.35);font-size:28px;font-weight:900;letter-spacing:6px;color:#f5f3e7;direction:ltr;text-align:center;">
          ${htmlEscape(code)}
        </div>
        <div style="margin-top:14px;color:rgba(255,255,255,0.75);font-size:12px;line-height:1.6;">
          דער קאָד איז גילטיג פאר <b>${htmlEscape(String(mins))}</b> מינוט.
          <br />
          אויב איר האָט נישט געבעטן דעם קאָד, קענט איר איגנאָרירן דעם אימעיל.
        </div>

        <div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(212,175,55,0.18);color:rgba(255,255,255,0.55);font-size:11px;direction:rtl;text-align:right;">
          © ${new Date().getFullYear()} Unity Credit. אלע רעכטן פארבאהאלטן. קאנפידענציעל.
        </div>
      </div>
    </div>
  </div>
  `.trim()

  return { subject, text, html }
}

export function welcomeEmail(params?: { firstName?: string | null }) {
  const name = String(params?.firstName || '').trim()
  const subject = yiddishSubject('welcome')
  const text =
    `שלום${name ? ` ${name}` : ''},\n\n` +
    `ברוכים־הבאים צו Unity Credit.\n\n` +
    `אייער אקאונט איז יעצט אַקטיוו.\n\n` +
    `יישר כח,\nUnity Credit`

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#0b0f14;padding:28px;">
    <div style="max-width:720px;margin:0 auto;background:#0f141b;border:1px solid rgba(212,175,55,0.25);border-radius:18px;overflow:hidden;">
      <div style="padding:18px 22px;background:linear-gradient(90deg,#0b0f14,#111827);border-bottom:1px solid rgba(212,175,55,0.25);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="font-weight:900;color:#d4af37;letter-spacing:0.5px;">Unity Credit</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.75);direction:rtl;text-align:right;">ברוכים־הבאים</div>
        </div>
      </div>

      <div style="padding:22px;direction:rtl;text-align:right;color:#e5e7eb;">
        <div style="font-size:18px;font-weight:900;color:#f5f3e7;">שלום${name ? ` ${htmlEscape(name)}` : ''},</div>
        <div style="margin-top:10px;color:rgba(255,255,255,0.82);font-size:13px;line-height:1.7;">
          ברוכים־הבאים צו Unity Credit. אייער אקאונט איז יעצט אַקטיוו.
        </div>

        <div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(212,175,55,0.18);color:rgba(255,255,255,0.55);font-size:11px;direction:rtl;text-align:right;">
          © ${new Date().getFullYear()} Unity Credit. אלע רעכטן פארבאהאלטן. קאנפידענציעל.
        </div>
      </div>
    </div>
  </div>
  `.trim()

  return { subject, text, html }
}


