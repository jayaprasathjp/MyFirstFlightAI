import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { LANGUAGES } from '../strings'
import { COMMON_COUNTRIES, COUNTRIES, callingCode, exampleNumber, flag, splitPhone } from '../phone'

// Two fields: the country (flag, name in the traveller's language, +code), then the local number.
// value / onChange use the full number, e.g. "+65 81234567". The common countries are listed first;
// typing a letter in the list jumps to that country.
export default function PhoneInput({ value, onChange, defaultCountry = 'IN', id, label }) {
  const { lang, t } = useI18n()
  const [country, setCountry] = useState(() => splitPhone(value, defaultCountry).country)
  const [national, setNational] = useState(() => splitPhone(value, defaultCountry).national)
  // An empty number follows the suggested country (e.g. "Lives at the destination" -> Singapore)
  useEffect(() => { if (!national.trim()) setCountry(defaultCountry) }, [defaultCountry]) // eslint-disable-line react-hooks/exhaustive-deps

  const locale = (LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]).locale
  const options = useMemo(() => {
    let dn
    try { dn = new Intl.DisplayNames([locale, 'en'], { type: 'region' }) } catch { dn = { of: (c) => c } }
    const item = (cc) => ({ cc, text: `${flag(cc)} ${dn.of(cc)} +${callingCode(cc)}`, name: dn.of(cc) })
    const rest = COUNTRIES.filter((c) => !COMMON_COUNTRIES.includes(c)).map(item).sort((a, b) => a.name.localeCompare(b.name, locale))
    return { common: COMMON_COUNTRIES.filter((c) => COUNTRIES.includes(c)).map(item), rest }
  }, [locale])

  const emit = (cc, num) => onChange(num.trim() ? `+${callingCode(cc)} ${num.trim()}` : '')
  return (
    <div className="phonein">
      <select aria-label={t('phone_country')} value={country}
        onChange={(e) => { setCountry(e.target.value); emit(e.target.value, national) }}>
        <optgroup label={t('phone_common')}>{options.common.map((o) => <option key={o.cc} value={o.cc}>{o.text}</option>)}</optgroup>
        <optgroup label={t('phone_all')}>{options.rest.map((o) => <option key={o.cc} value={o.cc}>{o.text}</option>)}</optgroup>
      </select>
      <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" aria-label={label} value={national}
        placeholder={exampleNumber(country)}
        onChange={(e) => {
          let cc = country, v = e.target.value
          if (v.trim().startsWith('+')) { // the whole number with its code was typed or pasted: pick that country
            const split = splitPhone(v, country)
            if (split.country && split.national !== v) { cc = split.country; v = split.national; setCountry(cc) }
          }
          setNational(v); emit(cc, v)
        }} />
    </div>
  )
}
