import { useState } from 'react'
import { useI18n } from '../i18n'

const DOCS = ['ticket', 'passport', 'visa']
const ASSIST = ['none', 'elderly', 'wheelchair', 'visually_impaired']

export function TripCard({ summary }) {
  const { t, fmtDate } = useI18n()
  if (!summary) return null
  return (
    <div className="boarding">
      <div className="row">
        <div><div className="iata">{summary.origin_code}</div><div className="city">{summary.origin_city} · {summary.departure_time}</div></div>
        <div className="plane" aria-hidden="true"><i></i>✈<i></i></div>
        <div className="end"><div className="iata">{summary.destination_code}</div><div className="city">{summary.destination_city} · {summary.arrival_time}</div></div>
      </div>
      <div className="meta">
        <div><span>{t('flight')}</span><b>{summary.flights.join(' + ')}</b></div>
        <div><span>{t('date')}</span><b>{fmtDate(summary.departure_date)}</b></div>
        <div><span>{t('cabin')}</span><b>{summary.cabin_bag_kg ? `${summary.cabin_bag_kg} kg` : '—'}</b></div>
        <div><span>{t('checked')}</span><b>{summary.checked_bag_kg ? `${summary.checked_bag_kg} kg` : '—'}</b></div>
      </div>
    </div>
  )
}

function AddTravellerForm({ onCancel, onSubmit, busy, canCancel }) {
  const { t } = useI18n()
  const [files, setFiles] = useState({ ticket: null, passport: null, visa: null })
  const [assistance, setAssistance] = useState('none')
  const [err, setErr] = useState('')

  const submit = () => {
    if (DOCS.some((d) => !files[d])) return setErr(t('err_files'))
    setErr('')
    onSubmit(files, assistance)
  }
  return (
    <div className="card form">
      <div className="drop">
        {DOCS.map((d) => (
          <label key={d} className={files[d] ? 'has' : ''}>
            <span className="docicon" aria-hidden="true">{files[d] ? '✓' : '+'}</span>
            <b>{t(d)}</b>
            <small>{files[d] ? files[d].name : t('tap_to_add')}</small>
            <input type="file" accept="image/*,application/pdf" disabled={busy}
              onChange={(e) => { setFiles((f) => ({ ...f, [d]: e.target.files[0] || null })); setErr('') }} />
          </label>
        ))}
      </div>
      <fieldset className="seg">
        <legend>{t('needs_assistance')}</legend>
        {ASSIST.map((a) => (
          <label key={a}>
            <input type="radio" name="assist" value={a} checked={assistance === a} disabled={busy} onChange={() => setAssistance(a)} />
            {t('assist_' + a)}
          </label>
        ))}
      </fieldset>
      {err && <div className="err" role="alert">{err}</div>}
      {busy && <div className="reading" role="status"><span className="spin" aria-hidden="true"></span>{t('reading')}</div>}
      <div className={canCancel ? 'row2' : ''}>
        {canCancel && <button className="btn sec" onClick={onCancel} disabled={busy}>{t('cancel')}</button>}
        <button className="btn pri full" onClick={submit} disabled={busy}>{t('check_documents')}</button>
      </div>
    </div>
  )
}

export default function TravellersScreen({ trip, onAdd, onRemove, onNext, busy, error }) {
  const { t } = useI18n()
  const [adding, setAdding] = useState(false)
  const showForm = adding || trip.travellers.length === 0

  const submit = async (files, assistance) => {
    if (await onAdd(files, assistance)) setAdding(false)
  }
  return (
    <>
      <h2>{t('travellers_title')}</h2>
      <p className="muted">{t('travellers_hint')}</p>
      <TripCard summary={trip.summary} />
      {trip.travellers.length > 0 && (
        <div className="pax">
          {trip.travellers.map((p) => (
            <div className="p" key={p.id}>
              <div className="av">{p.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2)}</div>
              <div>
                <b>{p.name}</b>
                <small>{t('passport')} {p.documents.passport?.number || '—'}</small>
                {p.assistance !== 'none' && <div className="tags"><span className="tag">{t('assist_' + p.assistance)}</span></div>}
              </div>
              <button className="link" onClick={() => onRemove(p.id)} disabled={busy}>{t('remove')}</button>
            </div>
          ))}
        </div>
      )}
      {error && <div className="err" role="alert">{error}</div>}
      {showForm
        ? <AddTravellerForm busy={busy} onSubmit={submit} onCancel={() => setAdding(false)} canCancel={trip.travellers.length > 0} />
        : <button className="btn ghost" onClick={() => setAdding(true)} disabled={busy}>+ {t('add_another')}</button>}
      {trip.travellers.length > 0 && !showForm && (
        <button className="btn pri full" onClick={onNext}>{t('continue')} →</button>
      )}
    </>
  )
}
