import { useEffect, useState } from 'react'
import { api, store } from './api'
import { useI18n } from './i18n'

// City and country names come from the ticket in English. Show them in the reader's language:
// translated once per language by the backend (cached there too), remembered on the phone.
// Not used on the I'm Lost card, which is for staff and stays in English.
const pending = new Set()
const listeners = new Set()
const keyOf = (lang) => `mff-places-${lang}`

export function usePlaces(names) {
  const { lang } = useI18n()
  const [cache, setCache] = useState(() => store.get(keyOf(lang), {}))
  useEffect(() => {
    setCache(store.get(keyOf(lang), {}))
    const hear = () => setCache(store.get(keyOf(lang), {}))
    listeners.add(hear)
    return () => listeners.delete(hear)
  }, [lang])
  const missing = lang === 'en' ? [] : [...new Set(names.filter(Boolean))].filter((n) => !(n in cache) && !pending.has(lang + n))
  const want = missing.join('|')
  useEffect(() => {
    if (!missing.length) return
    missing.forEach((n) => pending.add(lang + n))
    api.translate(lang, Object.fromEntries(missing.map((n, i) => [i, n])))
      .then((r) => {
        const all = { ...store.get(keyOf(lang), {}) }
        missing.forEach((n, i) => { all[n] = r.texts?.[i] || n })
        store.set(keyOf(lang), all)
        listeners.forEach((f) => f())
      })
      .catch(() => { /* keep the English names */ })
      .finally(() => missing.forEach((n) => pending.delete(lang + n)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, want])
  return (n) => (lang === 'en' || !n ? n : cache[n] || n)
}
