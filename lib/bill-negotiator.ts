export type BillType = 'utility' | 'cellular'

export type BillNegotiationInput = {
  provider_name: string
  bill_type: BillType
  current_monthly: number
  desired_monthly: number
  account_hint?: string | null
  notes?: string | null
}

export function buildBillNegotiationDraft(input: BillNegotiationInput) {
  const provider = String(input.provider_name || '').trim()
  const billType = input.bill_type === 'cellular' ? 'cellular' : 'utility'
  const current = Number(input.current_monthly) || 0
  const desired = Number(input.desired_monthly) || 0
  const account = String(input.account_hint || '').trim()
  const notes = String(input.notes || '').trim()

  const header =
    billType === 'cellular'
      ? 'א סעלולאר ביל־נעגאציע בקשה'
      : 'א יוטיליטי ביל־נעגאציע בקשה'

  const body = `שלום,

איך בין א קונה ביי ${provider || 'אייך'} און איך וויל איבערקוקן מיין מאנאטליכע ביל.

מיין יעצטיגער מאנאטlicher טשارج איז בערך $${current.toFixed(0)}.
איך זוך א בעסערע אפציע/רייט צו קומען בערך צו $${desired.toFixed(0)} א חודש (אדער בעסער).

ביטע שיקט מיר:
1) די בעסטע ריטענשן־אפער/דיסקאונט וואס איר קענט טון היינט
2) א ליסטע פון פלענער/רייטס וואס קען פאסן מיין ניצונג
3) אויב מען קען אוועקנעמען פיעס/אקטיוואציע־קאסץ/אדער געבן קרעדיט

${account ? `Account hint: ${account}\n\n` : ''}${notes ? `באמערקונגען:\n${notes}\n\n` : ''}א גרויסן דאנק.`

  return { subject: header, body }
}


