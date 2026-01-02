'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Save, Shield, FileDown, Eye } from 'lucide-react'
import UnityCreditLogoMark from '@/components/UnityCreditLogoMark'

type AdminSettings = {
  disclaimer_yi: string
  heimishe_categories: string[]
}

export default function SuperAdminDashboard() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState<AdminSettings>({ disclaimer_yi: '', heimishe_categories: [] })
  const [categoriesText, setCategoriesText] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [categoryCatalog, setCategoryCatalog] = useState<any>(null)

  const [brainInteractions, setBrainInteractions] = useState<any[]>([])
  const [vaultRows, setVaultRows] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [knowledgeAssets, setKnowledgeAssets] = useState<any[]>([])
  const [knowledgeStats, setKnowledgeStats] = useState<any>(null)
  const [brainLicenses, setBrainLicenses] = useState<any[]>([])

  const [vaultCategory, setVaultCategory] = useState<string>('insurance')
  const [inspect, setInspect] = useState<null | { title: string; json: any }>(null)

  const KNOWLEDGE_CATEGORIES = [
    { id: 'researcher', label: 'Researcher' },
    { id: 'negotiator', label: 'Negotiator' },
    { id: 'deal_hunter', label: 'Deal Hunter' },
    { id: 'shopping_scout', label: 'Shopping Scout' },
    { id: 'sales_accelerator', label: 'Sales Accelerator' },
  ] as const

  const [knowledgeCategory, setKnowledgeCategory] = useState<string>(KNOWLEDGE_CATEGORIES[0]?.id || 'researcher')
  const [uploadingAsset, setUploadingAsset] = useState(false)
  const [assetFile, setAssetFile] = useState<File | null>(null)
  const [assetNotes, setAssetNotes] = useState('')

  function pretty(v: any) {
    try {
      return JSON.stringify(v, null, 2)
    } catch {
      return String(v)
    }
  }

  async function load() {
    setLoading(true)
    try {
      const [s, u, m, bi, vv, al, ka, ks, bl, cc] = await Promise.all([
        fetch('/api/admin/settings').then((r) => r.json()),
        fetch('/api/admin/users?perPage=200&page=1').then((r) => r.json()),
        fetch('/api/admin/metrics?days=30').then((r) => r.json()).catch(() => null),
        fetch('/api/admin/unity-brain/interactions?limit=50').then((r) => r.json()).catch(() => null),
        fetch(`/api/admin/unity-savings-vault?limit=50&kind=advice&category=${encodeURIComponent(vaultCategory)}`)
          .then((r) => r.json())
          .catch(() => null),
        fetch('/api/admin/audit-logs?limit=300').then((r) => r.json()).catch(() => null),
        fetch(`/api/admin/knowledge-assets?limit=50&category=${encodeURIComponent(knowledgeCategory)}`).then((r) => r.json()).catch(() => null),
        fetch('/api/admin/unity-brain/knowledge/stats').then((r) => r.json()).catch(() => null),
        fetch('/api/admin/unity-brain/licenses/usage?limit=50').then((r) => r.json()).catch(() => null),
        fetch('/api/admin/category-catalog/latest').then((r) => r.json()).catch(() => null),
      ])
      if (s?.settings) {
        setSettings({
          disclaimer_yi: String(s.settings.disclaimer_yi || ''),
          heimishe_categories: Array.isArray(s.settings.heimishe_categories) ? s.settings.heimishe_categories : [],
        })
        setCategoriesText((Array.isArray(s.settings.heimishe_categories) ? s.settings.heimishe_categories : []).join('\n'))
      }
      if (u?.ok) setUsers(Array.isArray(u.users) ? u.users : [])
      if (m?.ok) setMetrics(m)
      if (cc?.ok) setCategoryCatalog(cc.db || null)

      if (bi?.ok) setBrainInteractions(Array.isArray(bi.rows) ? bi.rows : [])
      if (vv?.ok) setVaultRows(Array.isArray(vv.rows) ? vv.rows : [])
      if (al?.ok) setAuditLogs(Array.isArray(al.logs) ? al.logs : [])
      if (ka?.ok) setKnowledgeAssets(Array.isArray(ka.rows) ? ka.rows : [])
      if (ks?.ok) setKnowledgeStats(ks)
      if (bl?.ok) setBrainLicenses(Array.isArray(bl.rows) ? bl.rows : [])
    } catch (e: any) {
      toast({ title: 'Admin', description: e?.message || 'Failed to load', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Reload vault rows when category changes
    if (!loading) {
      ;(async () => {
        try {
          const vv = await fetch(`/api/admin/unity-savings-vault?limit=50&kind=advice&category=${encodeURIComponent(vaultCategory)}`).then((r) => r.json())
          if (vv?.ok) setVaultRows(Array.isArray(vv.rows) ? vv.rows : [])
        } catch {
          // ignore
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultCategory])

  useEffect(() => {
    // Reload knowledge assets when category changes
    if (!loading) {
      ;(async () => {
        try {
          const ka = await fetch(`/api/admin/knowledge-assets?limit=50&category=${encodeURIComponent(knowledgeCategory)}`).then((r) => r.json())
          if (ka?.ok) setKnowledgeAssets(Array.isArray(ka.rows) ? ka.rows : [])
        } catch {
          // ignore
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeCategory])

  async function uploadKnowledgeAssetNow() {
    if (uploadingAsset) return
    if (!assetFile) {
      toast({ title: 'Knowledge', description: 'Choose a file first.', variant: 'destructive' })
      return
    }
    setUploadingAsset(true)
    try {
      const fd = new FormData()
      fd.set('file', assetFile)
      fd.set('notes', assetNotes || '')
      fd.set('category', knowledgeCategory)

      const res = await fetch('/api/admin/knowledge-assets', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(String(json?.error || `Upload failed (HTTP ${res.status})`))

      toast({ title: 'Knowledge', description: 'Uploaded.' })
      setAssetFile(null)
      setAssetNotes('')
      await load()
    } catch (e: any) {
      toast({ title: 'Knowledge', description: e?.message || 'Upload failed', variant: 'destructive' })
    } finally {
      setUploadingAsset(false)
    }
  }

  async function saveSettings() {
    if (saving) return
    setSaving(true)
    try {
      const categories = categoriesText
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 240)

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disclaimer_yi: settings.disclaimer_yi,
          heimishe_categories: categories,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Save failed')
      toast({ title: 'Settings', description: 'Saved.' })
      await load()
    } catch (e: any) {
      toast({ title: 'Settings', description: e?.message || 'Save failed', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function decryptBrainInteraction(id: string) {
    try {
      const res = await fetch(`/api/admin/unity-brain/interactions?id=${encodeURIComponent(id)}&decrypt=1`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Decrypt failed')
      const row = Array.isArray(json.rows) && json.rows.length ? json.rows[0] : null
      setInspect({ title: `Unity Brain Interaction: ${id}`, json: row?.decrypted_payload ?? row ?? json })
    } catch (e: any) {
      toast({ title: 'Decrypt', description: e?.message || 'Decrypt failed', variant: 'destructive' })
    }
  }

  async function decryptVaultRow(id: string) {
    try {
      const res = await fetch(
        `/api/admin/unity-savings-vault?limit=1&decrypt=1&kind=advice&category=${encodeURIComponent(vaultCategory)}&id=${encodeURIComponent(id)}`
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Decrypt failed')
      const row = (Array.isArray(json.rows) ? json.rows : []).find((r: any) => String(r.id) === String(id)) || null
      setInspect({ title: `Savings Vault (advice): ${id}`, json: row?.decrypted_payload ?? row ?? json })
    } catch (e: any) {
      toast({ title: 'Decrypt', description: e?.message || 'Decrypt failed', variant: 'destructive' })
    }
  }

  async function seedCategoryCatalog() {
    try {
      const res = await fetch('/api/admin/category-catalog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'seed' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(String(json?.error || `Seed failed (HTTP ${res.status})`))
      toast({ title: 'Category catalog', description: `Seeded: ${Number(json?.seeded || 0)}` })
      await load()
    } catch (e: any) {
      toast({ title: 'Category catalog', description: e?.message || 'Seed failed', variant: 'destructive' })
    }
  }

  async function generateCategoryCatalog(limit = 5) {
    try {
      const res = await fetch('/api/admin/category-catalog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all', limit }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(String(json?.error || `Generate failed (HTTP ${res.status})`))
      toast({ title: 'Category catalog', description: `Generated. Categories: ${Number(json?.summary?.categories || 0)}` })
      await load()
    } catch (e: any) {
      toast({ title: 'Category catalog', description: e?.message || 'Generate failed', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-5xl mx-auto flex items-center gap-3 text-slate-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div className="text-sm">Loading admin…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {inspect ? (
          <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-200">
                <div className="font-black text-slate-900">{inspect.title}</div>
                <Button type="button" variant="outline" onClick={() => setInspect(null)}>
                  Close
                </Button>
              </div>
              <div className="p-4">
                <pre className="text-xs whitespace-pre-wrap break-words bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-[70vh] overflow-auto">
                  {pretty(inspect.json)}
                </pre>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <UnityCreditLogoMark size="sm" className="shadow-none" aria-label="Unity Credit" />
              <div>
                <div className="text-sm font-black text-slate-900 rtl-text text-right">Unity Credit — Admin (אַדמין)</div>
                <div className="text-xs text-slate-600 rtl-text text-right">Secure administration console</div>
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-600 rtl-text text-right">
            Intelligence execution runs in a separate secured service. This console intentionally exposes only user/admin-safe settings and user data.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-xl overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-slate-900 to-indigo-700" />
            <CardHeader className="pb-3">
              <CardTitle className="text-base rtl-text text-right flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Unity Brain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Interactions</span>
                <span className="font-mono">{brainInteractions.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Vault (advice)</span>
                <span className="font-mono">{vaultRows.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Audit logs</span>
                <span className="font-mono">{auditLogs.length}</span>
              </div>
              <div className="mt-3 text-xs text-slate-600">
                DB stats: {knowledgeStats?.counts ? pretty(knowledgeStats.counts) : '—'}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-700 to-amber-600" />
            <CardHeader className="pb-3">
              <CardTitle className="text-base rtl-text text-right">Knowledge Center</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Assets</span>
                <span className="font-mono">{knowledgeAssets.length}</span>
              </div>
              <div className="text-xs text-slate-600">Encrypted at rest; downloads decrypt server-side via `vault.ts`.</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-700 to-emerald-700" />
            <CardHeader className="pb-3">
              <CardTitle className="text-base rtl-text text-right">Brain Licenses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Rows</span>
                <span className="font-mono">{brainLicenses.length}</span>
              </div>
              <div className="text-xs text-slate-600">Usage table is read-only here.</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-slate-900 to-indigo-700" />
          <CardHeader className="pb-3">
            <CardTitle className="text-xl rtl-text text-right">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-slate-600 rtl-text text-right">Disclaimer (Yiddish)</div>
            <Textarea
              value={settings.disclaimer_yi}
              onChange={(e) => setSettings((p) => ({ ...p, disclaimer_yi: e.target.value }))}
              className="min-h-[90px] rtl-text text-right"
              placeholder="די דאטא ווערט געהאלטן פריוואט..."
            />

            <div className="text-xs text-slate-600 rtl-text text-right">Heimishe categories (one per line)</div>
            <Textarea value={categoriesText} onChange={(e) => setCategoriesText(e.target.value)} className="min-h-[140px] rtl-text text-right" />

            <div className="flex justify-end">
              <Button type="button" className="h-10 font-semibold" onClick={saveSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-700 to-indigo-700" />
          <CardHeader className="pb-3">
            <CardTitle className="text-xl rtl-text text-right">Category Catalog (storage)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm text-slate-700">
                Categories: <span className="font-mono">{Array.isArray(categoryCatalog?.categories) ? categoryCatalog.categories.length : 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="h-10" onClick={seedCategoryCatalog}>
                  Seed defaults
                </Button>
                <Button type="button" variant="outline" className="h-10" onClick={() => generateCategoryCatalog(5)}>
                  Generate 5
                </Button>
                <Button type="button" className="h-10" onClick={load}>
                  Refresh
                </Button>
              </div>
            </div>

            <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-[900px] w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Key</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Label</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Kind</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Providers</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Updated</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(categoryCatalog?.categories) && categoryCatalog.categories.length ? (
                    categoryCatalog.categories.slice(0, 80).map((c: any) => (
                      <tr key={String(c.key)} className="border-t border-slate-200">
                        <td className="p-3 text-xs text-slate-700 font-mono">{String(c.key || '')}</td>
                        <td className="p-3 text-sm text-slate-800">{String(c.label || '')}</td>
                        <td className="p-3 text-xs text-slate-700">{String(c.kind || '')}</td>
                        <td className="p-3 text-xs text-slate-700 font-mono">{Array.isArray(c.providers) ? c.providers.length : 0}</td>
                        <td className="p-3 text-xs text-slate-600 font-mono">{String(c.updated_at || '').slice(0, 19)}</td>
                        <td className="p-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9"
                            onClick={() => setInspect({ title: `Category: ${String(c.key)}`, json: c })}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-sm text-slate-600">
                        No categories yet. Click “Seed defaults”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-700 to-gold" />
          <CardHeader className="pb-3">
            <CardTitle className="text-xl rtl-text text-right">Unity Brain Interactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-slate-600 rtl-text text-right">Encrypted logs (decrypt is server-side via `vault.ts`).</div>
            <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-[1100px] w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Created</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Kind</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Source</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Request</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">User</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {brainInteractions.length ? (
                    brainInteractions.slice(0, 50).map((r: any) => (
                      <tr key={String(r.id)} className="border-t border-slate-200">
                        <td className="p-3 text-xs text-slate-600 font-mono">{String(r.created_at || '').slice(0, 19)}</td>
                        <td className="p-3 text-sm text-slate-800">{String(r.kind || '')}</td>
                        <td className="p-3 text-sm text-slate-700">{String(r.source || '')}</td>
                        <td className="p-3 text-xs text-slate-700 font-mono">{String(r.request_id || r.id || '').slice(0, 26)}</td>
                        <td className="p-3 text-xs text-slate-700 font-mono">{String(r.user_id || '—').slice(0, 18)}</td>
                        <td className="p-3">
                          <Button type="button" variant="outline" className="h-9" onClick={() => decryptBrainInteraction(String(r.id))}>
                            <Eye className="h-4 w-4 mr-2" />
                            Decrypt
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-sm text-slate-600">
                        No interactions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-600 to-emerald-700" />
          <CardHeader className="pb-3">
            <CardTitle className="text-xl rtl-text text-right">Unity Savings Vault (category)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-slate-600">Category</div>
              <div className="flex items-center gap-2">
                <select
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  value={vaultCategory}
                  onChange={(e) => setVaultCategory(e.target.value)}
                >
                  {['insurance', 'phone', 'utilities', 'internet', 'subscription', 'other'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" className="h-10" onClick={load}>
                  Refresh
                </Button>
              </div>
            </div>

            <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-[1100px] w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Merchant</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Kind</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Category</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Success</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Last seen</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {vaultRows.length ? (
                    vaultRows.slice(0, 50).map((r: any) => (
                      <tr key={String(r.id)} className="border-t border-slate-200">
                        <td className="p-3 text-sm text-slate-800">{String(r.merchant || '—')}</td>
                        <td className="p-3 text-sm text-slate-700">{String(r.kind || '')}</td>
                        <td className="p-3 text-sm text-slate-700">{String(r.category || '')}</td>
                        <td className="p-3 text-sm text-slate-700 font-mono">{String(r.success_count || 0)}</td>
                        <td className="p-3 text-xs text-slate-600 font-mono">{String(r.last_seen_at || '').slice(0, 19)}</td>
                        <td className="p-3">
                          <Button type="button" variant="outline" className="h-9" onClick={() => decryptVaultRow(String(r.id))}>
                            <Eye className="h-4 w-4 mr-2" />
                            Decrypt
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-sm text-slate-600">
                        No vault rows.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-slate-900 to-emerald-600" />
          <CardHeader className="pb-3">
            <CardTitle className="text-xl rtl-text text-right">Verification / Audit Logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-slate-600 rtl-text text-right">Node verification log trail (encrypted if configured).</div>
            <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-[1100px] w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Logged</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Request</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">OK</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Blocked</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Domain</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length ? (
                    auditLogs.slice(0, 120).map((r: any, idx: number) => (
                      <tr key={`${idx}`} className="border-t border-slate-200">
                        <td className="p-3 text-xs text-slate-600 font-mono">{String(r.logged_at || r.at || r.ts || '').slice(0, 19)}</td>
                        <td className="p-3 text-xs text-slate-700 font-mono">{String(r.request_id || '').slice(0, 28) || '—'}</td>
                        <td className="p-3 text-xs text-slate-700">{String(Boolean(r.ok))}</td>
                        <td className="p-3 text-xs text-slate-700">{String(Boolean(r.blocked))}</td>
                        <td className="p-3 text-xs text-slate-700">{String(r.domain || '—')}</td>
                        <td className="p-3 text-xs text-slate-600">{String(r.reason || '').slice(0, 120) || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-sm text-slate-600">
                        No audit logs.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-700 to-amber-600" />
          <CardHeader className="pb-3">
            <CardTitle className="text-xl rtl-text text-right">Knowledge Assets (encrypted storage)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-slate-600 rtl-text text-right">Download decrypts server-side (service role + vault key required).</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-bold text-slate-900">Unity Intelligence Category</div>
                <select
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  value={knowledgeCategory}
                  onChange={(e) => setKnowledgeCategory(e.target.value)}
                  disabled={uploadingAsset}
                >
                  {KNOWLEDGE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700">Upload (encrypted)</div>
                  <input
                    type="file"
                    className="block w-full text-sm"
                    onChange={(e) => setAssetFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                    disabled={uploadingAsset}
                  />
                </div>
                <Button type="button" onClick={uploadKnowledgeAssetNow} disabled={uploadingAsset || !assetFile} className="h-10">
                  {uploadingAsset ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Upload
                </Button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">Notes (optional)</div>
                <Textarea value={assetNotes} onChange={(e) => setAssetNotes(e.target.value)} className="min-h-[70px]" placeholder="What is this file used for?" />
              </div>
            </div>
            <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-[1100px] w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Created</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Unity Intelligence Category</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Filename</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">SHA</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Notes</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {knowledgeAssets.length ? (
                    knowledgeAssets.slice(0, 50).map((r: any) => (
                      <tr key={String(r.id)} className="border-t border-slate-200">
                        <td className="p-3 text-xs text-slate-600 font-mono">{String(r.created_at || '').slice(0, 19)}</td>
                        <td className="p-3 text-xs text-slate-700 font-mono">
                          {(() => {
                            const p = String(r.storage_path || '')
                            const m = p.match(/^vault\/([^/]+)\//)
                            return m ? m[1] : 'general'
                          })()}
                        </td>
                        <td className="p-3 text-sm text-slate-800">{String(r.filename || '—')}</td>
                        <td className="p-3 text-xs text-slate-700 font-mono">{String(r.sha256 || '').slice(0, 16)}</td>
                        <td className="p-3 text-xs text-slate-600">{String(r.notes || '').slice(0, 80) || '—'}</td>
                        <td className="p-3">
                          <a
                            className="inline-flex items-center justify-center h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 text-sm font-semibold"
                            href={`/api/admin/knowledge-assets/download?id=${encodeURIComponent(String(r.id))}`}
                          >
                            <FileDown className="h-4 w-4 mr-2" />
                            Download
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-sm text-slate-600">
                        No assets.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-700 to-amber-600" />
          <CardHeader className="pb-3">
            <CardTitle className="text-xl rtl-text text-right">Revenue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs text-slate-600 rtl-text text-right">Last 30 days (best-effort)</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-600 rtl-text text-right">Total revenue</div>
                <div className="text-2xl font-black text-slate-900">${String(metrics?.revenue?.total_usd || '0.00')}</div>
            </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-600 rtl-text text-right">Premium active</div>
                <div className="text-2xl font-black text-slate-900">{Number(metrics?.subscribers?.premium_active || 0)}</div>
            </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-600 rtl-text text-right">Trials active</div>
                <div className="text-2xl font-black text-slate-900">{Number(metrics?.subscribers?.trial_active || 0)}</div>
            </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-700 to-emerald-700" />
          <CardHeader className="pb-3">
            <CardTitle className="text-xl rtl-text text-right">Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-slate-600 rtl-text text-right">
              Total: <span className="font-mono">{users.length}</span>
            </div>
            <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-[900px] w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left text-xs font-bold text-slate-700 p-3 rtl-text text-right">Email</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3 rtl-text text-right">Name</th>
                    <th className="text-left text-xs font-bold text-slate-700 p-3 rtl-text text-right">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length ? (
                    users.slice(0, 200).map((u: any) => (
                      <tr key={String(u.id || u.email || Math.random())} className="border-t border-slate-200">
                        <td className="p-3 text-sm text-slate-800 rtl-text text-right">{String(u.email || '—')}</td>
                        <td className="p-3 text-sm text-slate-700 rtl-text text-right">{String(u.full_name || u.name || '—')}</td>
                        <td className="p-3 text-xs text-slate-600 font-mono">{String(u.created_at || u.createdAt || '—').slice(0, 19)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="p-4 text-sm text-slate-600 rtl-text text-right">
                        No users.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

            <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={load} className="h-10">
            Refresh
              </Button>
            </div>
                    </div>
              </div>
  )
}


