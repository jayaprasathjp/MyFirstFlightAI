import { useEffect, useState } from 'react'
import { api, store } from './api'
import { I18nCtx } from './i18n'
import { EN, LANGUAGES } from './strings'

const SRC = JSON.stringify(EN)
const cached = (lang) => {
  const c = store.get(`mff-ui-${lang}`, null)
  return c && c.src === SRC ? c.texts : null
}

export default function I18nProvider({ lang, children }) {
  const [fetched, setFetched] = useState({})
  const meta = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]
  const texts = lang === 'en' ? EN : { ...EN, ...(fetched[lang] || cached(lang)) }

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr'
  }, [lang, meta.rtl])

  useEffect(() => {
    if (lang === 'en' || cached(lang)) return
    let alive = true
    api.translate(lang, EN)
      .then((r) => {
        store.set(`mff-ui-${lang}`, { src: SRC, texts: r.texts })
        if (alive) setFetched((f) => ({ ...f, [lang]: r.texts }))
      })
      .catch(() => { /* keep English */ })
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
