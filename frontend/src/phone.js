// Phone numbers checked by each country's own rules (Google's libphonenumber: Singapore 8 digits, India 10,
// USA 10, ...). Same library as the server (backend/schemas.py normalize_phone, Python "phonenumbers").
// "min" data (lengths and leading digits per country) keeps the app small; the server double-checks with full data.
import { getCountries, getCountryCallingCode, getExampleNumber, parsePhoneNumberFromString } from 'libphonenumber-js/min'
import examples from 'libphonenumber-js/mobile/examples'

// Countries first-time flyers from India call most, shown at the top of the list.
export const COMMON_COUNTRIES = ['IN', 'SG', 'AE', 'SA', 'QA', 'OM', 'KW', 'BH', 'MY', 'TH', 'US', 'GB', 'CA', 'AU', 'JP', 'LK', 'NP', 'BD']
export const COUNTRIES = getCountries()
export const callingCode = (cc) => getCountryCallingCode(cc)
export const flag = (cc) => String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)))

// A number in its country's local form, e.g. "8123 4567" for Singapore (used in messages and placeholders).
export const exampleNumber = (cc) => getExampleNumber(cc, examples)?.formatNational() || ''

// "+65 8123 4567" if valid for that country, else null. Without +code the number is read for `country`.
export function normalizePhone(raw, country = 'IN') {
  const n = parsePhoneNumberFromString(String(raw || '').trim(), country)
  return n && n.isValid() ? n.formatInternational() : null
}

// Split a stored "+65 8123 4567" into its country and local number (for editing).
export function splitPhone(raw, fallback = 'IN') {
  const n = raw ? parsePhoneNumberFromString(String(raw), fallback) : null
  return n?.country ? { country: n.country, national: n.formatNational() } : { country: fallback, national: raw || '' }
}

// ISO country code from a country name such as "Singapore" (the trip's destination).
const names = (() => {
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' })
    return Object.fromEntries(COUNTRIES.map((cc) => [dn.of(cc).toLowerCase(), cc]))
  } catch { return {} }
})()
const ALIASES = { uae: 'AE', 'united arab emirates': 'AE', usa: 'US', 'united states of america': 'US', uk: 'GB', 'great britain': 'GB' }
export function countryFromName(name) {
  const k = String(name || '').trim().toLowerCase()
  return names[k] || ALIASES[k] || null
}
