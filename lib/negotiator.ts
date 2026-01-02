export type InsuranceNegotiationInput = {
  line?: 'home' | 'car' | 'life'
  name?: string
  address?: string
  policy_number?: string
  phone?: string
  provider_name?: string
  email?: string
  // Optional structured details (used only if the template includes placeholders for them)
  current_premium_monthly?: number | string
  desired_monthly_savings?: number | string
  notes?: string
}

export function fillTemplate(template: string, data: InsuranceNegotiationInput) {
  const t = String(template || '')
  const today = new Date()
  const dateISO = today.toISOString().slice(0, 10)
  const dateLocal = today.toLocaleDateString()
  const line = data.line === 'car' ? 'car' : data.line === 'life' ? 'life' : 'home'
  const map: Record<string, string> = {
    // Line
    '[סארט]': line === 'car' ? 'קאר־אינשורענס' : line === 'life' ? 'לייף־אינשורענס' : 'הויז־אינשורענס',
    // Identity / contact
    '[נאמען]': String(data.name || '').trim(),
    '[אדרעס]': String(data.address || '').trim(),
    '[פאליסי נומער]': String(data.policy_number || '').trim(),
    '[טעלעפאן]': String(data.phone || '').trim(),
    '[קאמפאניע]': String(data.provider_name || '').trim(),
    '[אימעיל]': String(data.email || '').trim(),
    // Dates
    '[דאטום]': dateISO,
    '[היינט]': dateLocal,
    // Money
    '[היינטיגע פרעמיע]': String(data.current_premium_monthly ?? '').toString().trim(),
    '[געוואלטע סאווינגס]': String(data.desired_monthly_savings ?? '').toString().trim(),
    // Notes
    '[באמערקונגען]': String(data.notes || '').trim(),
  }
  let out = t
  for (const [k, v] of Object.entries(map)) {
    out = out.replaceAll(k, v || k)
  }
  // Support simple mustache-style placeholders too (optional/back-compat).
  out = out
    .replaceAll('{{name}}', map['[נאמען]'] || '{{name}}')
    .replaceAll('{{address}}', map['[אדרעס]'] || '{{address}}')
    .replaceAll('{{policy_number}}', map['[פאליסי נומער]'] || '{{policy_number}}')
    .replaceAll('{{phone}}', map['[טעלעפאן]'] || '{{phone}}')
    .replaceAll('{{provider_name}}', map['[קאמפאניע]'] || '{{provider_name}}')
    .replaceAll('{{line}}', map['[סארט]'] || '{{line}}')
    .replaceAll('{{date}}', map['[דאטום]'] || '{{date}}')
  return out
}
