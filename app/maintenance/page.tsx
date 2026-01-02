export const runtime = 'nodejs'

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b0f14] via-[#0f141b] to-[#111827] flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl">
        <div className="text-2xl font-black text-[#d4af37] rtl-text text-right">טעכנישע סערוויס</div>
        <div className="mt-3 text-base text-white/90 rtl-text text-right">
          מיר האבן יעצט א קליינע טעכנישע פראבלעם, עס וועט צוריק ארבעטן אין די קומענדיגע פאר שעה
        </div>
        <div className="mt-6 text-xs text-white/60 rtl-text text-right">
          Unity Credit · Maintenance Mode
        </div>
      </div>
    </div>
  )
}


