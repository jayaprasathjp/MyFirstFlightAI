import { useState } from 'react'
import { useI18n } from '../i18n'

const PHONE = /^\+?[0-9][0-9 ()-]{5,19}$/
const EMPTY = { name: '', relation: '', phone: '', at_destination: false }

function initialRows(trip) {
  if (trip.contacts.length) return trip.contacts.map((c) => ({ ...c }))
  const host = trip.destination_contact
  // Prefill the local contact printed on the visa, plus an empty row for family at home.
  return host ? [{ ...EMPTY }, { ...host, at_destination: true, fromVisa: true }] : [{ ...EMPTY }]
}

export default function ContactsScreen({ trip, onSave, busy, error }) {
  const { t } = useI18n()
  const [rows, setRows] = useState(() => initialRows(trip))
  const [err, setErr] = useState('')

  const edit = (i, field, value) => { setRows((r) => r.map((row, n) => (n === i ? { ...row, [field]: value } : row))); setErr('') }
  const submit = () => {
    const filled = rows.filter((r) => r.name.trim() || r.phone.trim())
    if (!filled.length || filled.some((r) => !r.name.trim() || !PHONE.test(r.phone.trim()))) return setErr(t('err_contacts'))
    onSave(filled.map(({ name, relation, phone, at_destination }) =>
      ({ name: name.trim(), relation: relation.trim(), phone: phone.trim(), at_destination })))
  }

  return (
    <>
      <h2>{t('contacts_title')}</h2>
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
          <label>{t('contact_phone')}
            <input type="tel" inputMode="tel" value={r.phone} placeholder="+91 98400 12345" onChange={(e) => edit(i, 'phone', e.target.value)} />
          </label>
          <fieldset className="seg">
            <legend>{t('contact_where')}</legend>
            <label>
              <input type="radio" name={`where${i}`} checked={!r.at_destination} onChange={() => edit(i, 'at_destination', false)} />
              {t('at_home')}{trip.summary?.origin_city && <small> · {trip.summary.origin_city}</small>}
            </label>
            <label>
              <input type="radio" name={`where${i}`} checked={r.at_destination} onChange={() => edit(i, 'at_destination', true)} />
              {t('at_destination')}{trip.summary?.destination_city && <small> · {trip.summary.destination_city}</small>}
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
