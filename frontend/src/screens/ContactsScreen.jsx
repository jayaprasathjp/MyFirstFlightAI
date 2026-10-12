import { useState } from 'react'
import { useI18n } from '../i18n'
import { usePlaces } from '../places'
import Listen from '../components/Listen'
import { countryFromName, normalizePhone, splitPhone } from '../phone'
import PhoneInput from '../components/PhoneInput'

const EMPTY = { name: '', relation: '', phone: '', at_destination: false }

function initialRows(trip) {
  if (trip.contacts.length) return trip.contacts.map((c) => ({ ...c }))
  const host = trip.destination_contact
  // Prefill the local contact printed on the visa, plus an empty row for family at home.
  return host ? [{ ...EMPTY }, { ...host, at_destination: true, fromVisa: true }] : [{ ...EMPTY }]
}

export default function ContactsScreen({ trip, onSave, busy, error, toast }) {
  const { t, lang } = useI18n()
  const countryName = (cc) => { try { return new Intl.DisplayNames([lang, 'en'], { type: 'region' }).of(cc) } catch { return cc } }
  const place = usePlaces([trip.summary?.origin_city, trip.summary?.destination_city])
  const [rows, setRows] = useState(() => initialRows(trip))
  const [err, setErr] = useState('')

  const edit = (i, field, value) => { setRows((r) => r.map((row, n) => (n === i ? { ...row, [field]: value } : row))); setErr('') }
  // Phone country suggested per row: where the trip starts, or the destination for "Lives at the destination".
  const homeCC = countryFromName(trip.summary?.origin_country) || 'IN'
  const destCC = countryFromName(trip.summary?.destination_country) || homeCC
  const submit = () => {
    const filled = rows.filter((r) => r.name.trim() || r.phone.trim())
    if (!filled.length || filled.some((r) => !r.name.trim() || !r.phone.trim())) return setErr(t('err_contacts'))
    const bad = filled.find((r) => !normalizePhone(r.phone))
    if (bad) {
      const cc = splitPhone(bad.phone, bad.at_destination ? destCC : homeCC).country
      return setErr(`${bad.name.trim()}: ${t('err_phone_country', { country: countryName(cc) })}`)
    }
    onSave(filled.map(({ name, relation, phone, at_destination }) =>
      ({ name: name.trim(), relation: relation.trim(), phone: normalizePhone(phone), at_destination })))
  }

  return (
    <>
      <div className="gh"><h2>{t('contacts_title')}</h2><Listen text={`${t('contacts_title')}. ${t('contacts_hint')}`} toast={toast} /></div>
      <p className="muted">{t('contacts_hint')}</p>
      {rows.map((r, i) => (
        <div className="card form" key={i}>
          {r.fromVisa && <span className="tag">{t('from_visa')}</span>}
          <label>{t('contact_name')}
            <input type="text" value={r.name} autoComplete="off" onChange={(e) => edit(i, 'name', e.target.value)} />
          </label>
          <label>{t('contact_relation')}
            <input type="text" value={r.relation} autoComplete="off" onChange={(e) => edit(i, 'relation', e.target.value)} />
          </label>
          <label htmlFor={`phone${i}`}>{t('contact_phone')}</label>
          <PhoneInput id={`phone${i}`} label={t('contact_phone')} value={r.phone} onChange={(v) => edit(i, 'phone', v)}
            defaultCountry={r.at_destination ? destCC : homeCC} />
          <fieldset className="seg">
            <legend>{t('contact_where')}</legend>
            <label>
              <input type="radio" name={`where${i}`} checked={!r.at_destination} onChange={() => edit(i, 'at_destination', false)} />
              {t('at_home')}{trip.summary?.origin_city && <small> · {place(trip.summary.origin_city)}</small>}
            </label>
            <label>
              <input type="radio" name={`where${i}`} checked={r.at_destination} onChange={() => edit(i, 'at_destination', true)} />
              {t('at_destination')}{trip.summary?.destination_city && <small> · {place(trip.summary.destination_city)}</small>}
            </label>
          </fieldset>
        </div>
      ))}
      {rows.length < 5 && <button className="btn ghost" onClick={() => setRows((r) => [...r, { ...EMPTY }])}>+ {t('add_contact')}</button>}
      {(err || error) && <div className="err" role="alert">{err || error}</div>}
      <button className="btn pri full" onClick={submit} disabled={busy}>{t('save_continue')} →</button>
    </>
  )
}
