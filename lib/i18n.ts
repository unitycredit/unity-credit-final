export type AppLanguage = 'yi' | 'en'

export const DEFAULT_LANGUAGE: AppLanguage = 'yi'

type Dict = Record<string, string>

const yi: Dict = {
  // Global
  'nav.brand': 'UnityCredit',
  'nav.dashboard': '',
  'nav.settings': 'Settings',
  'nav.logout': 'ארויסגיין',
  'toast.logout.title': 'ארויסגעגאנגען',
  'toast.logout.desc': 'איר זענט זיכער ארויסגעגאנגען.',
  'toast.error.title': 'טעות',

  // Settings
  'settings.title': 'Settings',
  'settings.email': 'אימעיל',
  'settings.name': 'נאמען',
  'settings.phone': 'טעלעפאן',
  'settings.language.title': 'שפראך',
  'settings.language.desc': 'וועלט אויס די שפראך פאר דער גאנצער אפליקאציע.',
  'settings.language.yi': 'ייִדיש',
  'settings.language.en': 'ענגליש',
  'settings.adminAccess.title': 'אַדמין־צוטריט',
  'settings.adminAccess.desc': 'דאס איז נאר א שארטקאט. פאר אמת’דיגער אַדמין־צוטריט דארף מען נאך אלץ דעם Master Password.',
  'settings.adminAccess.openLogin': 'עפענען אַדמין־לאגין',
  'settings.adminAccess.openDashboard': 'עפענען אַדמין־פּאַנעל',

  // Auth
  'login.title': 'אַרײַנלאָגין',
  'login.subtitle': 'אריין צו אייער קאנטע',
  'login.email': 'אימעיל',
  'login.password': 'פּאַראָל',
  'login.email.placeholder': 'שרייב אייער אימעיל',
  'login.password.placeholder': 'שרייב אייער פּאַראָל',
  'login.submit': 'אַרײַנלאָגין',
  'login.submitting': 'לאָגט אַרײַן...',
  'login.noAccount': 'האסט נישט קיין אקאונט?',
  'login.signup': 'זיך אריינשרייבן',

  'signup.title': 'מאכן א קאנטע',
  'signup.subtitle': 'שאַפֿט א קאנטע פאר Unity Credit און הייבט אָן מיט אייער פינאַנציעלע פּלאַן',
  'signup.firstName': 'ערשטער נאמען',
  'signup.lastName': 'לעצטער נאמען',
  'signup.phone': 'טעלעפאן נומער',
  'signup.password': 'פאסווארט',
  'signup.confirmPassword': 'באשטעטיג פאסווארט',

  // Dashboard (new section)
  'heimishe.title': 'בודזשעט אויסגאבן',
  'heimishe.desc': 'לייג אריין אייער מאנאטליכע היימישע הוצאות לויט קאטעגאריעס.',
  'heimishe.category': 'קאטעגאריע',
  'heimishe.monthly': 'מאנאטליך (סומע)',
  'heimishe.total': 'גאנצער סך־הכל',

  // Dashboard (loading / modules)
  'dashboard.loading.unityLogic': 'לאדנט Unity Credit...',
  'dashboard.loading.savingsFinder': 'לאדנט Unity Savings Finder...',
  'dashboard.loading.activeSavings': 'לאדנט אקטיווע סאווינגס...',
  'dashboard.loading.smartAlerts': 'לאדנט סמאַרט־אַלערטן...',
  'dashboard.loading.monthlySavingsSummary': 'לאדנט סאווינגס־סיכום...',

  // Dashboard (Heimishe Smart Budget Table)
  'heimisheSmart.title': 'היימישע סמאַרט־בודזשעט טאבעלע',
  'heimisheSmart.desc':
    'לייגט אריין א סכום אין איינע פון די שפאלטן — די אנדערע ווערן אויטאמאטיש אויסגערעכנט.',
  'heimisheSmart.category': 'קאַטעגאָריע',
  'heimisheSmart.weekly': 'וואכנשריפט',
  "heimisheSmart.monthly": "חודש'ליך",
  'heimisheSmart.yearly': 'יערליך',
  'heimisheSmart.total': 'סך־הכל',
  'heimisheSmart.clearRow': 'אויסמעקן די שורה',
  'heimisheSmart.noteFactors': 'רעכענונג: וואכנשריפט × 4.33 = חודש׳ליך; וואכנשריפט × 52 = יערליך; חודש׳ליך × 12 = יערליך.',
  'heimisheSmart.addCategory': 'צולייגן קאַטעגאָריע',
  'heimisheSmart.addCategory.placeholder': 'שרייבט א נאמען (למשל: מעשר)',
  'heimisheSmart.add': 'צולייגן',
  'heimisheSmart.import': 'אימפארט ליסטע (א שורה = א קאַטעגאָריע)',
  'heimisheSmart.import.placeholder': 'פאסט דא אריין אייער פולע ליסטע (איין קאַטעגאָריע אין יעדער שורה)…',
  'heimisheSmart.import.apply': 'אימפארטירן',
}

const en: Dict = {
  // Global
  'nav.brand': 'UnityCredit',
  'nav.dashboard': '',
  'nav.settings': 'Settings',
  'nav.logout': 'Log out',
  'toast.logout.title': 'Logged out',
  'toast.logout.desc': 'You have been securely logged out.',
  'toast.error.title': 'Error',

  // Settings
  'settings.title': 'Settings',
  'settings.email': 'Email',
  'settings.name': 'Name',
  'settings.phone': 'Phone',
  'settings.language.title': 'Language',
  'settings.language.desc': 'Choose the language for the entire application.',
  'settings.language.yi': 'Yiddish',
  'settings.language.en': 'English',
  'settings.adminAccess.title': 'Admin access',
  'settings.adminAccess.desc': 'This is only a shortcut. Real admin access still requires the master password.',
  'settings.adminAccess.openLogin': 'Open admin login',
  'settings.adminAccess.openDashboard': 'Open admin panel',

  // Auth
  'login.title': 'Sign in',
  'login.subtitle': 'Access your account',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.email.placeholder': 'Enter your email',
  'login.password.placeholder': 'Enter your password',
  'login.submit': 'Sign in',
  'login.submitting': 'Signing in...',
  'login.noAccount': "Don't have an account?",
  'login.signup': 'Create one',

  'signup.title': 'Create account',
  'signup.subtitle': 'Create an account and start your financial journey',
  'signup.firstName': 'First name',
  'signup.lastName': 'Last name',
  'signup.phone': 'Phone number',
  'signup.password': 'Password',
  'signup.confirmPassword': 'Confirm password',

  // Dashboard (new section)
  'heimishe.title': 'Budget Categories',
  'heimishe.desc': 'Enter monthly amounts by category.',
  'heimishe.category': 'Category',
  'heimishe.monthly': 'Monthly amount',
  'heimishe.total': 'Total',

  // Dashboard (loading / modules)
  'dashboard.loading.unityLogic': 'Loading Unity Credit…',
  'dashboard.loading.savingsFinder': 'Loading Unity Savings Finder…',
  'dashboard.loading.activeSavings': 'Loading Active Savings…',
  'dashboard.loading.smartAlerts': 'Loading Smart Alerts…',
  'dashboard.loading.monthlySavingsSummary': 'Loading Savings Summary…',

  // Dashboard (Heimishe Smart Budget Table)
  'heimisheSmart.title': 'Heimishe Smart Budget Table',
  'heimisheSmart.desc':
    'Enter an amount in any one column and the other columns will auto-calculate.',
  'heimisheSmart.category': 'Category',
  'heimisheSmart.weekly': 'Weekly',
  'heimisheSmart.monthly': 'Monthly',
  'heimisheSmart.yearly': 'Yearly',
  'heimisheSmart.total': 'Total',
  'heimisheSmart.clearRow': 'Clear row',
  'heimisheSmart.noteFactors': 'Math: Weekly × 4.33 = Monthly; Weekly × 52 = Yearly; Monthly × 12 = Yearly.',
  'heimisheSmart.addCategory': 'Add category',
  'heimisheSmart.addCategory.placeholder': 'Type a name (e.g., Maaser)',
  'heimisheSmart.add': 'Add',
  'heimisheSmart.import': 'Import list (one line = one category)',
  'heimisheSmart.import.placeholder': 'Paste your full list here (one category per line)…',
  'heimisheSmart.import.apply': 'Import',
}

export function getDictionary(lang: AppLanguage): Dict {
  return lang === 'en' ? en : yi
}

export function normalizeLanguage(raw: string | null | undefined): AppLanguage {
  if (raw === 'en') return 'en'
  return 'yi'
}


