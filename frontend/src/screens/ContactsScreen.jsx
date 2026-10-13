import { useState } from 'react'
import { useI18n } from '../i18n'
import { usePlaces } from '../places'
import Listen from '../components/Listen'
import { countryFromName, normalizePhone, splitPhone } from '../phone'
import PhoneInput from '../components/PhoneInput'
import Icon from '../components/Icon'

const EMPTY = { name: '', relation: '', phone: '', at_destination: false }
// Each card keeps its own id, so removing one never mixes up the fields (phone country) of the others.
let nextId = 0
const row = (fields = {}) => ({ ...EMPTY, ...fields, rowId: ++nextId })

function initialRows(trip) {
  if (trip.contacts.length) return trip.contacts.map((c) => row(c))
  const host = trip.destination_contact
  // Prefill the local contact printed on the visa, plus an empty row for family at home.
  return host ? [row(), row({ ...host, at_destination: true, fromVisa: true })] : [row()]
}

export default function ContactsScreen({ trip, onSave, busy, error, toast }) {
  const { t, lang } = useI18n()
  const countryName = (cc) => { try { return new Intl.DisplayNames([lang, 'en'], { type: 'region' }).of(cc) } catch { return cc } }
  const place = usePlaces([trip.summary?.origin_city, trip.summary?.destination_city])
  const [rows, setRows] = useState(() => initialRows(trip))
  const [err, setErr] = useState('')

  const edit = (i, field, value) => { setRows((r) => r.map((x, n) => (n === i ? { ...x, [field]: value } : x))); setErr('') }
  // Remove a card (saved when the traveller taps Save). The last card is cleared instead, so the form stays.
  const remove = (i) => { setRows((r) => (r.length > 1 ? r.filter((_, n) => n !== i) : [row()])); setErr('') }
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
        <div className="card form" key={r.rowId}>
          <div className="contact-head">
            {r.fromVisa ? <span className="tag">{t('from_visa')}</span> : <span />}
            <button type="button" className="btn sec contact-remove" onClick={() => remove(i)}
              aria-label={`${t('remove')} ${r.name.trim() || t('contact_name')}`}>
              <Icon name="trash" size={18} /> {t('remove')}
            </button>
          </div>
          <label>{t('contact_name')}
            <input type="text" value={r.name} autoComplete="off" onChange={(e) => edit(i, 'name', e.target.value)} />
          </label>
          <label>{t('contact_relation')}
            <input type="text" value={r.relation} autoComplete="off" onChange={(e) => edit(i, 'relation', e.target.value)} />
          </label>
          <label htmlFor={`phone${r.rowId}`}>{t('contact_phone')}</label>
          <PhoneInput id={`phone${r.rowId}`} label={t('contact_phone')} value={r.phone} onChange={(v) => edit(i, 'phone', v)}
            defaultCountry={r.at_destination ? destCC : homeCC} />
          <fieldset className="seg">
            <legend>{t('contact_where')}</legend>
            <label>
              <input type="radio" name={`where${r.rowId}`} checked={!r.at_destination} onChange={() => edit(i, 'at_destination', false)} />
              {t('at_home')}{trip.summary?.origin_city && <small> · {place(trip.summary.origin_city)}</small>}
            </label>
            <label>
              <input type="radio" name={`where${r.rowId}`} checked={r.at_destination} onChange={() => edit(i, 'at_destination', true)} />
              {t('at_destination')}{trip.summary?.destination_city && <small> · {place(trip.summary.destination_city)}</small>}
            </label>
          </fieldset>
        </div>
      ))}
      {rows.length < 5 && <button className="btn ghost" onClick={() => setRows((r) => [...r, row()])}>+ {t('add_contact')}</button>}
      {(err || error) && <div className="err" role="alert">{err || error}</div>}
      <button className="btn pri full" onClick={submit} disabled={busy}>{t('save_continue')} →</button>
    </>
  )
}
