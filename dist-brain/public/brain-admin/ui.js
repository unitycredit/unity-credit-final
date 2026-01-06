function $(id) {
  return document.getElementById(id)
}

function fmtUsd(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `$${v.toLocaleString()}`
}

function setStatus(kind, text) {
  const pill = $('statusPill')
  pill.classList.remove('ok', 'warn', 'bad')
  if (kind) pill.classList.add(kind)
  pill.textContent = text
}

function showCard(cardId, textId, msg) {
  const card = $(cardId)
  const text = $(textId)
  if (!msg) {
    card.style.display = 'none'
    text.textContent = ''
    return
  }
  card.style.display = 'block'
  text.textContent = String(msg)
}

async function loadStats() {
  showCard('errorCard', 'errorText', '')
  showCard('warningCard', 'warningText', '')
  setStatus('', 'Loading…')

  try {
    const url = new URL('/v1/admin/stats', window.location.origin)
    const res = await fetch(url.toString(), { cache: 'no-store' })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json) throw new Error(`Failed to load stats (${res.status})`)

    const ok = Boolean(json.ok)
    const warning = json.warning || ''

    $('mrr').textContent = `MRR: ${fmtUsd(json?.revenue?.mrr_usd ?? 0)}`
    $('arr').textContent = `ARR: ${fmtUsd(json?.revenue?.arr_usd ?? 0)}`
    $('i30').textContent = `Interactions (30d): ${Number(json?.ai_usage?.interactions_30d ?? 0).toLocaleString()}`
    $('insights').textContent = `Insights (total): ${Number(json?.ai_usage?.insights_total ?? 0).toLocaleString()}`
    $('growth').textContent = `Growth (30d): ${Number(json?.users?.growth_30d ?? 0).toLocaleString()}`

    if (warning) {
      setStatus('warn', 'Degraded')
      showCard('warningCard', 'warningText', warning)
    } else {
      setStatus(ok ? 'ok' : 'bad', ok ? 'OK' : 'Not OK')
    }
  } catch (e) {
    setStatus('bad', 'Error')
    showCard('errorCard', 'errorText', e?.message || e)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('refreshBtn')?.addEventListener('click', () => void loadStats())
  void loadStats()
  setInterval(() => void loadStats(), 15_000)
})


