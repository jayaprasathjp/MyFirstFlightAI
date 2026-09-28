import { useEffect, useState } from 'react'
import { api, store } from './api'
import { I18nCtx } from './i18n'
import { EN, LANGUAGES } from './strings'

// Pre-translated label files (backend/tools/gen_ui_locales.py), each loaded only when that language is chosen.
const BUNDLED = import.meta.glob(['./locales/*.json', '!./locales/en.json'], { import: 'default' })
const SRC = JSON.stringify(EN)
const cached = (lang) => {
  const c = store.get(`mff-ui-${lang}`, null)
  return c && c.src === SRC ? c.texts : null
}

async function loadLabels(lang) {
  const file = BUNDLED[`./locales/${lang}.json`]
  const bundled = file ? await file() : {}
  const source = bundled.__source || {}
  // Use a bundled label only if it was translated from the current English text.
  const texts = Object.fromEntries(Object.keys(EN).filter((k) => bundled[k] && source[k] === EN[k]).map((k) => [k, bundled[k]]))
  const missing = Object.fromEntries(Object.entries(EN).filter(([k]) => !(k in texts)))
  if (Object.keys(missing).length) {
    try { Object.assign(texts, (await api.translate(lang, missing)).texts) } catch { /* keep English for these */ }
  }
  return texts
}

export default function I18nProvider({ lang, children }) {
  const [loaded, setLoaded] = useState({})
  const meta = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]
  const texts = lang === 'en' ? EN : { ...EN, ...(loaded[lang] || cached(lang)) }

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr'
  }, [lang, meta.rtl])

  useEffect(() => {
    if (lang === 'en' || cached(lang)) return
    let alive = true
    loadLabels(lang).then((t) => {
      store.set(`mff-ui-${lang}`, { src: SRC, texts: t })
      if (alive) setLoaded((l) => ({ ...l, [lang]: t }))
    })
    return () => { alive = false }
  }, [lang])

  const t = (k, vars) => {
    let s = texts[k] ?? k
    for (const [name, value] of Object.entries(vars || {})) s = s.split(`{${name}}`).join(value)
    return s
  }
  const fmtDate = (iso, opts = { day: 'numeric', month: 'short' }) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-').map(Number)
    try { return new Intl.DateTimeFormat(meta.locale, opts).format(new Date(y, m - 1, d)) } catch { return iso }
  }
  return <I18nCtx.Provider value={{ lang, t, fmtDate }}>{children}</I18nCtx.Provider>
}
