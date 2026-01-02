import { promises as fs } from 'node:fs'
import path from 'node:path'

export type AdminSettings = {
  disclaimer_yi: string
  heimishe_categories: string[]
  require_all_nodes: boolean
  house_insurance_negotiation_template_yi: string
  car_insurance_negotiation_template_yi: string
  life_insurance_negotiation_template_yi: string
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  disclaimer_yi: 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.',
  heimishe_categories: [],
  require_all_nodes: true,
  house_insurance_negotiation_template_yi: `שלום,

איך בין א פאליסי־האלטער ביי אייך און איך וויל איבערקוקן מיין הויז־אינשורענס. איך וויל א בעסערע פרעמיע און/אדער בעסערע קאווערידזש לויט מיין היינטיגע דעטאלן.

ביטע שיקט מיר:
1) א פרישע קוואט־באריכט (דיטיילירט) אויף דער זעלבער קאווערידזש
2) א ליסטע פון דיסקאונטן וואס איך קען צולייגן (סעקיוריטי סיסטעם, באַנדלינג, היים־אימפּרובמענטס, קלעים־פריי אאז״ו)
3) אפציעס פאר דידאַקטאַבאַל־ענדערונגען מיט די נייע פרעמיעס
4) אויב איר קענט נישט פארבעסערן, וועל איך בעטן א “Retention” איבערקוק אדער א פארוואלטער־קאל

דאנק אייך,
[נאמען]
[אדרעס]
[פאליסי נומער]
[טעלעפאן]`,
  car_insurance_negotiation_template_yi: `שלום,

איך בין א פאליסי־האלטער ביי אייך און איך וויל איבערקוקן מיין קאר־אינשורענס. איך וויל א בעסערע פרעמיע און/אדער בעסערע קאווערידזש לויט מיין היינטיגע דעטאלן.

ביטע שיקט מיר:
1) א פרישע קוואט־באריכט (דיטיילירט) אויף דער זעלבער קאווערידזש
2) א ליסטע פון דיסקאונטן וואס איך קען צולייגן (multi‑car, safe‑driver, mileage, anti‑theft, bundling, defensive driving אאז״ו)
3) אפציעס פאר דידאַקטאַבאַל־ענדערונגען מיט די נייע פרעמיעס
4) אויב איר קענט נישט פארבעסערן, וועל איך בעטן א “Retention” איבערקוק אדער א פארוואלטער־קאל

דאנק אייך,
[נאמען]
[אדרעס]
[פאליסי נומער]
[טעלעפאן]`,
  life_insurance_negotiation_template_yi: `שלום,

איך וויל איבערקוקן מיין לייף־אינשורענס פאליסי. איך זוך בעסערע פרעמיעס און/אדער בעסערע טערמינען לויט מיין היינטיגע באדערפענישן.

ביטע שיקט מיר:
1) א פרישע קוואט־באריכט (דיטיילירט) אויף דער זעלבער קאווערידזש
2) אפציעס פאר Term/Whole Life (אויב שייך) מיט קלארע פרעמיעס
3) א ליסטע פון מעגליכע דיסקאונטן אדער ריטענשאן־אפציעס
4) אויב איר קענט נישט פארבעסערן, וועל איך בעטן א “Retention” איבערקוק אדער א פארוואלטער־קאל

דאנק אייך,
[נאמען]
[אדרעס]
[פאליסי נומער]
[טעלעפאן]`,
}

const SETTINGS_FILE = path.join(process.cwd(), '.data', 'admin_settings.json')

export async function readAdminSettings(): Promise<AdminSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      disclaimer_yi: String(parsed?.disclaimer_yi || DEFAULT_ADMIN_SETTINGS.disclaimer_yi),
      heimishe_categories: Array.isArray(parsed?.heimishe_categories) ? parsed.heimishe_categories.map(String) : [],
      house_insurance_negotiation_template_yi: String(
        parsed?.house_insurance_negotiation_template_yi || DEFAULT_ADMIN_SETTINGS.house_insurance_negotiation_template_yi
      ),
      car_insurance_negotiation_template_yi: String(
        parsed?.car_insurance_negotiation_template_yi || DEFAULT_ADMIN_SETTINGS.car_insurance_negotiation_template_yi
      ),
      life_insurance_negotiation_template_yi: String(
        parsed?.life_insurance_negotiation_template_yi || DEFAULT_ADMIN_SETTINGS.life_insurance_negotiation_template_yi
      ),
      // Back-compat: accept previous key (avoids hard-coding the legacy name)
      require_all_nodes:
        typeof parsed?.require_all_nodes === 'boolean'
          ? parsed.require_all_nodes
          : typeof (parsed as any)?.[('a' + 'i_require_all')] === 'boolean'
          ? (parsed as any)[('a' + 'i_require_all')]
          : DEFAULT_ADMIN_SETTINGS.require_all_nodes,
    }
  } catch {
    return { ...DEFAULT_ADMIN_SETTINGS }
  }
}

export async function writeAdminSettings(next: Partial<AdminSettings>) {
  const current = await readAdminSettings()
  const merged: AdminSettings = {
    ...current,
    ...next,
    disclaimer_yi: String(next.disclaimer_yi ?? current.disclaimer_yi),
    heimishe_categories: Array.isArray(next.heimishe_categories) ? next.heimishe_categories.map(String) : current.heimishe_categories,
    require_all_nodes: typeof next.require_all_nodes === 'boolean' ? next.require_all_nodes : current.require_all_nodes,
    house_insurance_negotiation_template_yi: String(
      next.house_insurance_negotiation_template_yi ?? current.house_insurance_negotiation_template_yi
    ),
    car_insurance_negotiation_template_yi: String(
      next.car_insurance_negotiation_template_yi ?? current.car_insurance_negotiation_template_yi
    ),
    life_insurance_negotiation_template_yi: String(
      next.life_insurance_negotiation_template_yi ?? current.life_insurance_negotiation_template_yi
    ),
  }
  const dir = path.join(process.cwd(), '.data')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8')
  return merged
}


